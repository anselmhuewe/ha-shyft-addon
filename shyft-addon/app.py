from sync_service import SyncService, convert_to_expected_unit, compute_wallbox_max_kw
from homeassistant_adapter import HomeAssistantAdapter
from shyft_adapter import ShyftAdapter
from live_entity_watcher import LiveEntityWatcher
from constants import DEMO_SHYFT_ACCESS_KEY
import problem_registry

import os
from flask import Flask, send_from_directory, jsonify, request, Response
import json
import math
import re
import shutil
import time
import csv
import io
import threading
from datetime import datetime, timezone, timedelta, date
from apscheduler.schedulers.background import BackgroundScheduler
import logging
import sys


def load_addon_version():
    "Reads the version straight from config.yaml so there's a single source of truth (previously a separate version.py could drift out of sync)"
    try:
        with open("config.yaml", "r", encoding="utf-8") as f:
            match = re.search(r'^version:\s*"([^"]+)"', f.read(), re.MULTILINE)
            if match:
                return match.group(1)
    except Exception:
        pass
    return "0.0.0.0"


logging.basicConfig(stream=sys.stdout, level=logging.INFO)
app = Flask(__name__, static_folder="www", static_url_path="")

VERSION = load_addon_version()
SHYFT_ACCESS_KEY = "not_set_yet"
DETAILED_LOGGING = False
OPTIONS_PATH = "/data/options.json"
CONFIG_PATH = "/data/config.json"
DASHBOARD_CACHE_PATH = "/data/dashboard_cache.json"
# Anders als DASHBOARD_CACHE_PATH (stuendlich ueberschrieben) wird dieser Snapshot nur EINMAL pro
# Kalendertag geschrieben - die zu Tagesbeginn bekannte PV-Prognose, eingefroren, damit sie sich
# spaeter gegen die tatsaechlich eingetretenen Werte vergleichen laesst (siehe
# _maybe_freeze_pv_forecast_snapshot / /dashboard/pv-forecast-vs-actual). Ohne dieses Einfrieren
# wuerde ein Abgleich am Nachmittag die laengst korrigierte (nicht die urspruengliche) Prognose fuer
# den Vormittag zeigen.
PV_FORECAST_SNAPSHOT_PATH = "/data/pv_forecast_snapshot.json"
CAR_PRESENCE_LOG_PATH = "/data/car_presence_log.json"
CAR_PRESENCE_LOG_MAX_DAYS = 180
CAR_PRESENCE_MIN_SAMPLES = 3
# Feste Sicherheits-Heuristik (siehe away_return_ceiling): eine normale Tages-Abwesenheit bleibt
# unangetastet (GRACE_HOURS), danach halbiert sich die zulässige Rückkehrwahrscheinlichkeit je
# weitere HALF_LIFE_HOURS - unabhängig davon, ob die gelernte Tabelle für so eine lange
# Abwesenheit überhaupt schon Beobachtungen hat (z.B. beim allerersten Urlaub).
CAR_PRESENCE_AWAY_GRACE_HOURS = 8
CAR_PRESENCE_AWAY_HALF_LIFE_HOURS = 24
CAR_PRESENCE_AWAY_CEILING_FLOOR = 0.02
# Begrenzter Einfluss des Akkustands auf die Einsteck-Wahrscheinlichkeit: bei leerem Akku maximal
# +15% relativ zur gelernten Rate - bewusst schwach, da eine niedrige Reichweite unterwegs genauso
# gut "fährt zum Schnelllader" bedeuten kann wie "fährt bald nach Hause".
CAR_PRESENCE_SOC_INFLUENCE = 0.15
# Feste Grenze (nicht gelernt) zwischen "steht nur" (Vampire Drain) und "unterwegs" - ein SOC-
# Rückgang pro Stunde unterhalb dieser Schwelle zählt als Standzeit, darüber als Fahrt. Der
# tatsächliche kWh-Verbrauchswert unterscheidet sich dadurch NICHT (ein kleiner Fahrt-Verbrauch
# sieht rechnerisch genauso aus wie Vampire Drain) - die Schwelle dient nur der Einfärbung.
CAR_VAMPIRE_DRAIN_THRESHOLD_PCT_PER_HOUR = 1.0
# Ein SOC-Delta wird nur einer einzelnen Stunde zugerechnet, wenn der vorherige Log-Eintrag nicht
# allzu lange zurückliegt - sonst würde z.B. ein mehrtägiger Addon-Ausfall faelschlich als ein
# einzelner Mega-Verbrauch in einer Stunde verbucht und würde die gelernten Durchschnittswerte
# verzerren.
CAR_PRESENCE_MAX_GAP_HOURS_FOR_DELTA = 2
PV_SURPLUS_ACTIONS_PATH = "/data/pv_surplus_actions.json"
PV_SURPLUS_ACTIONS_MAX_DAYS = 14
# Startschwelle (Netzeinspeisung, kW - negativ = Einspeisung): strenger ohne Heimspeicher, da dort
# kein Puffer existiert, der einen kurzen Regel-Fehlschuss abfedern würde.
PV_SURPLUS_START_THRESHOLD_KW = -0.3
PV_SURPLUS_START_THRESHOLD_NO_BATTERY_KW = -1.5
# Laufende Erhöhen/Senken-Schwelle - bewusst näher an 0 als die Startschwelle (Hysterese), da wir
# hier "wird noch/nicht mehr eingespeist" unterscheiden, nicht "lohnt sich ein Start".
PV_SURPLUS_REGULATION_THRESHOLD_KW = -0.2
PV_SURPLUS_INCREASE_OVERSHOOT = 1.1
PV_SURPLUS_NO_BATTERY_INCREASE_SCALE = 0.9
PV_SURPLUS_DECREASE_RATIO = 0.05
PV_SURPLUS_NO_BATTERY_DECREASE_RATIO = 0.10
PV_SURPLUS_NO_BATTERY_MIN_DECREASE_KW = 0.3
PV_SURPLUS_BATTERY_STOP_SOC = 97
# Batterie-Vorzeichen ist nicht herstellerunabhaengig standardisiert (siehe
# detect_battery_flow_sign_convention) - 7 Tage Historie reichen normalerweise fuer mehrere klare
# Lade-/Entladewechsel; unter BATTERY_SIGN_MIN_SAMPLES eindeutigen Stunden gilt die Erkennung als
# nicht belastbar (lieber "noch unbekannt" als eine Zufalls-Mehrheit aus 1-2 Stunden).
BATTERY_SIGN_DETECTION_DAYS = 7
BATTERY_SIGN_MIN_SAMPLES = 6
SUPERVISOR_TOKEN = os.getenv("SUPERVISOR_TOKEN")
HASSIO_URI_RUNNING_ON_HAOS = "http://supervisor/core"
HASSIO_URI_RUNNING_REMOTE = "http://homeassistant.local:8123"
HEATING_TARGET_TEMP_SCRIPT_ID = "shyft_heizung_soll_temperatur"

def mask_secret(secret):
    if not secret or len(secret) < 10:
        return "not set"
    return f"{secret[:6]}***{secret[-4:]}"


def extract_shyft_user_id(access_key):
    "The shyft_access_key is formatted as '<prefix>|<user_id>|<secret>'; the actions endpoint needs that user_id as a separate parameter"
    parts = (access_key or "").split("|")
    return parts[1] if len(parts) == 3 else ""


homeassistant_adapter = HomeAssistantAdapter(
    homeassistant_uri=HASSIO_URI_RUNNING_ON_HAOS,
    supervisor_token=SUPERVISOR_TOKEN)
shyft_adapter = ShyftAdapter()
sync_service = SyncService(homeassistant_adapter, shyft_adapter)
# lambda statt der Funktion direkt, da _read_current_config erst weiter unten in dieser Datei
# definiert wird - zum Zeitpunkt dieses Aufrufs zaehlt nur, dass der Name bis zum ersten
# tatsaechlichen Aufruf (beim ersten (Re-)Connect, lange nach dem Modul-Import) existiert.
live_entity_watcher = LiveEntityWatcher(homeassistant_adapter, lambda: _read_current_config())

@app.after_request
def add_no_cache_headers(response):
    "Prevents the browser from serving a stale app.js/index.html after an addon update"
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response


# Serve the static HTML, with the app.js cache-busting query param filled in
@app.route("/")
def index():
    with open(os.path.join("www", "index.html"), "r", encoding="utf-8") as file:
        html = file.read()
    html = html.replace("{{VERSION}}", VERSION)
    return Response(html, mimetype="text/html")

# Delivers data to bubble
@app.route("/trigger", methods=["POST"])
def triggerEndpoint():
    return sync_site_data()


@app.route("/account-status", methods=["GET"])
def accountStatusEndpoint():
    "Tells the frontend whether the currently configured shyft_access_key is still the shared demo account (see DEMO_SHYFT_ACCESS_KEY) - drives the Demo-Popup in www/index.html. Compares the raw configured key (before any test_ prefix stripping, see ShyftAdapter.set_access_key) against the raw demo key."
    return jsonify({"isDemo": SHYFT_ACCESS_KEY == DEMO_SHYFT_ACCESS_KEY})


def _persist_shyft_access_key(new_access_key):
    """Writes shyft_access_key into this addon's own Supervisor-managed options
    (POST /addons/self/options) so it survives restarts and shows correctly in HA's Configuration
    tab for this addon - the addon can't just write /data/options.json itself and expect it to
    stick, Supervisor owns that file and would overwrite it again from its own state. Also updates
    the in-memory value right away (SHYFT_ACCESS_KEY, shyft_adapter.set_access_key) so a restart
    isn't needed before the new key takes effect."""
    global SHYFT_ACCESS_KEY
    homeassistant_adapter.post_to_supervisor("/addons/self/options", {"options": {"shyft_access_key": new_access_key}})
    SHYFT_ACCESS_KEY = new_access_key
    shyft_adapter.set_access_key(new_access_key)


@app.route("/set-access-key", methods=["POST"])
def setAccessKeyEndpoint():
    "Manually hinterlegt einen bestehenden shyft_access_key (siehe 'Shyft-Zugangstoken ändern' in www/index.html) - fuer Nutzer, die schon einen Account haben, oder um das Konto zu wechseln."
    body = request.get_json(silent=True) or {}
    access_key = (body.get("access_key") or "").strip()
    if not access_key:
        return jsonify({"status": "error", "message": "Zugangstoken darf nicht leer sein."})
    try:
        _persist_shyft_access_key(access_key)
    except Exception as e:
        print("[Shyft] Zugangstoken konnte nicht gespeichert werden:", repr(e))
        return jsonify({"status": "error", "message": "Zugangstoken konnte nicht gespeichert werden."})
    return jsonify({"status": "success"})


@app.route("/create-account", methods=["POST"])
def createAccountEndpoint():
    """Signs a new shyft-power account up for a demo-mode addon user (siehe Demo-Popup in
    www/index.html) - ruft create_user_addon auf und hinterlegt den zurueckgegebenen access_key bei
    Erfolg direkt selbst (siehe _persist_shyft_access_key). 'has an account' == 'yes' in der Antwort
    wird als Fehler gedeutet (Bubbles 'Sign the user up' meldet damit, dass die E-Mail-Adresse
    bereits einen Account hat) - dann wird NICHTS gespeichert."""
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip()
    password = body.get("password") or ""
    if not email or not password:
        return jsonify({"status": "error", "message": "E-Mail-Adresse und Passwort werden benötigt."})
    try:
        result = shyft_adapter.create_user(email, password)
    except Exception as e:
        print("[Shyft] Konto-Erstellung fehlgeschlagen:", repr(e))
        return jsonify({"status": "error", "message": "Der Account konnte nicht angelegt werden. Bitte versuche es später erneut."})
    has_account_raw = str(result.get("has an account", "")).strip().lower()
    if has_account_raw in ("yes", "true", "1"):
        return jsonify({"status": "error", "message": "Für diese E-Mail-Adresse existiert bereits ein Account. Nutze stattdessen \"Shyft-Zugangstoken ändern\", um dich mit deinem bestehenden Zugangstoken anzumelden."})
    new_access_key = result.get("access_key")
    if not new_access_key:
        print("[Shyft] create_user_addon lieferte keinen access_key:", result)
        return jsonify({"status": "error", "message": "Der Account konnte nicht angelegt werden (kein Zugangstoken erhalten)."})
    try:
        _persist_shyft_access_key(new_access_key)
    except Exception as e:
        print("[Shyft] Zugangstoken nach Konto-Erstellung konnte nicht gespeichert werden:", repr(e))
        return jsonify({"status": "error", "message": "Der Account wurde angelegt, aber der Zugangstoken konnte nicht gespeichert werden. Bitte trage ihn manuell über \"Shyft-Zugangstoken ändern\" ein."})
    return jsonify({"status": "success"})

def sync_site_data():
    "Hourly addon->Bubble sync (also the manual 'Verbindung testen' trigger): builds the consolidated staticConfig+liveValues+EV-forecast JSON and sends it via update_site_addon - replaces the old per-sensor addon_sensor_data workflow."
    config = _read_current_config()
    optimizer_period = int(config.get("optimizationPeriodsSite") or 48)
    static_config = sync_service.collect_static_config()
    live_values = sync_service.collect_live_values()
    ev_fields = build_ev_optimizer_fields(config, optimizer_period=optimizer_period)
    if ev_fields:
        live_values["ev_usage_h"] = ev_fields["ev_usage_h"]
        live_values["d_ev_kwh"] = ev_fields["d_ev_kwh"]
        live_values["baseTime"] = ev_fields["baseTime"]
    wb_p_min = compute_wb_p_min()
    if wb_p_min is not None:
        live_values["WB - p_min"] = wb_p_min
    payload = json.dumps({"staticConfig": static_config, "liveValues": live_values})
    try:
        _update_input_csv_health(config, live_values)
    except Exception as e:
        print("[Shyft] Problem-Registry-Abgleich (input.csv) fehlgeschlagen:", repr(e))
    return shyft_adapter.send_site_data(payload)

def sync_pv_history():
    "Step01 pv history addon"
    return sync_service.sync_pv_history()

@app.route("/config", methods=["GET"])
def readConfig():
    content = "nothing"
    with open(CONFIG_PATH, "r") as file:
        content = file.read()

    return content


@app.route("/sensorids", methods=["GET"])
def readSensorIds():
    response = homeassistant_adapter.get_from_homeassistant("/api/states")
    return mapToResponse(response)


@app.route("/integrations", methods=["GET"])
def readIntegrations():
    return jsonify(homeassistant_adapter.get_integrations_and_entities())


@app.route("/notification-targets", methods=["GET"])
def readNotificationTargets():
    "Lists paired phones (Home Assistant Mobile App integration) as notification targets"
    try:
        return jsonify(homeassistant_adapter.get_mobile_app_notify_targets())
    except Exception as e:
        print("Failed to load notification targets:", repr(e))
        return jsonify([])


@app.route("/shyft/actions", methods=["GET"])
def readShyftActions():
    """Pulls the action queue from shyft-power for display in the Gerätesteuerung tab (the actual
    execution against devices happens separately in process_shyft_actions), merged with the
    addon's own PV-Überschussladen-Rückfalllogik sessions (see run_pv_surplus_charging_tick) so
    they appear seamlessly alongside shyft-power's own actions instead of a separate list."""
    user_id = extract_shyft_user_id(shyft_adapter.bubble_token)
    result = shyft_adapter.get_actions(user_id) if user_id else {"status": "error", "message": "Kein gültiger Shyft-Access-Key konfiguriert."}
    pv_surplus_actions = [_pv_surplus_session_to_action(s) for s in _read_pv_surplus_actions()]

    if result.get("status") == "success":
        response_data = result.setdefault("response", {})
        response_data["actions"] = (response_data.get("actions") or []) + pv_surplus_actions
    elif pv_surplus_actions:
        result = {"status": "success", "response": {"actions": pv_surplus_actions}}
    return jsonify(result)


@app.route("/dashboard/chart-data", methods=["GET"])
def readDashboardChartData():
    """Builds the Dashboard tab's three charts (Strompreis, Außentemperatur, PV-Leistung) from the
    locally cached optimizer input_csv (see sync_dashboard_chart_data, refreshed hourly - the
    chart data itself only changes about that often, so there's no need for a live shyft-power
    call on every page load) - one row per hour, starting at creation_date rounded down to the
    start of its hour."""
    try:
        with open(DASHBOARD_CACHE_PATH, "r") as f:
            cache = json.load(f)
    except Exception:
        return jsonify({"status": "error", "message": "Noch keine Dashboard-Daten von shyft-power vorhanden - die nächste stündliche Aktualisierung steht noch aus."})

    input_csv = cache.get("input_csv")
    output_csv = cache.get("output_csv")
    creation_date_ms = cache.get("creation_date")
    if not input_csv or creation_date_ms is None:
        return jsonify({"status": "error", "message": "input_csv oder creation_date fehlt im Dashboard-Cache."})

    start = datetime.fromtimestamp(creation_date_ms / 1000, tz=timezone.utc).replace(minute=0, second=0, microsecond=0)

    try:
        rows = list(csv.DictReader(io.StringIO(input_csv), delimiter=";"))
        labels = []
        pv_generation = []
        p_buy = []
        temperature = []
        for i, row in enumerate(rows):
            labels.append((start + timedelta(hours=i)).isoformat())
            pv_generation.append(float(row.get("PV_generation") or 0))
            p_buy.append(float(row.get("p_buy") or 0))
            temperature.append(float(row.get("Temperature") or 0))
    except Exception as e:
        return jsonify({"status": "error", "message": f"input_csv konnte nicht gelesen werden: {e}"})

    # output_csv isn't necessarily the same length as input_csv (the optimizer's own horizon can
    # be shorter) - it's assumed to start at the same creation_date regardless, just with fewer rows
    output_labels, t_i_target, t_hw, soc_b, soc_ev = [], [], [], [], []
    if output_csv:
        try:
            output_rows = list(csv.DictReader(io.StringIO(output_csv)))
            for i, row in enumerate(output_rows):
                output_labels.append((start + timedelta(hours=i)).isoformat())
                t_i_target.append(float(row.get("T_i_Target") or 0))
                t_hw.append(float(row.get("T_HW") or 0))
                soc_b.append(float(row.get("SOC_B") or 0))
                soc_ev.append(float(row.get("SOC_EV") or 0))
        except Exception as e:
            print("[Shyft] output_csv konnte nicht gelesen werden:", repr(e))

    return jsonify({
        "status": "success",
        "labels": labels,
        "pv_generation": pv_generation,
        "p_buy": p_buy,
        "temperature": temperature,
        "output_labels": output_labels,
        "t_i_target": t_i_target,
        "t_hw": t_hw,
        "soc_b": soc_b,
        "soc_ev": soc_ev,
    })


def _hour_floor(dt):
    return dt.replace(minute=0, second=0, microsecond=0)


def _read_future_pv_forecast_by_hour():
    "Die normale, stuendlich ueberschriebene Prognose (siehe DASHBOARD_CACHE_PATH) als {Stunde (lokal): kW} - liefert i.d.R. ab 'jetzt' vorwaerts."
    try:
        with open(DASHBOARD_CACHE_PATH, "r") as f:
            cache = json.load(f)
    except Exception:
        return {}
    input_csv = cache.get("input_csv")
    creation_date_ms = cache.get("creation_date")
    if not input_csv or creation_date_ms is None:
        return {}
    start_utc = datetime.fromtimestamp(creation_date_ms / 1000, tz=timezone.utc).replace(minute=0, second=0, microsecond=0)
    try:
        rows = list(csv.DictReader(io.StringIO(input_csv), delimiter=";"))
    except Exception:
        return {}
    result = {}
    for i, row in enumerate(rows):
        hour_local = _hour_floor((start_utc + timedelta(hours=i)).astimezone())
        result[hour_local] = float(row.get("PV_generation") or 0)
    return result


@app.route("/dashboard/pv-forecast-vs-actual", methods=["GET"])
def readPvForecastVsActual():
    """Eine gemeinsame stundenweise Zeitachse ab 0 Uhr (lokale Zeit) fuer den Prognose-vs-Ist-
    Vergleich im PV-Leistung-Chart: 'forecast' kombiniert die heute frueh eingefrorene Tages-
    Prognose (siehe _maybe_freeze_pv_forecast_snapshot - fuer die bereits vergangenen wie auch noch
    kommenden Stunden HEUTE) mit der normalen, laufend aktualisierten Prognose (fuer alles ab
    morgen); 'actual' sind die stundenweise gemittelten tatsaechlichen Messwerte von 0 Uhr bis
    jetzt, nur fuer heute (keine Ist-Werte fuer die Zukunft). Fehlende Werte je Stunde sind null,
    nicht ausgelassen - hält beide Reihen synchron zur selben labels-Achse, wie es das Frontend zum
    Zeichnen zweier Linien braucht."""
    config = _read_current_config()
    entity_id = config.get("sensorMappings", {}).get("photovoltaic_powerflow_pv", "")

    today_local = date.today().isoformat()
    snapshot = _read_pv_forecast_snapshot()
    today_forecast_by_hour = {}
    if snapshot and snapshot.get("date") == today_local:
        for label, value in zip(snapshot.get("labels", []), snapshot.get("pv_generation", [])):
            try:
                today_forecast_by_hour[_hour_floor(datetime.fromisoformat(label).astimezone())] = value
            except ValueError:
                continue

    future_forecast_by_hour = _read_future_pv_forecast_by_hour()

    actual_by_hour = {}
    if entity_id:
        now_local = datetime.now().astimezone()
        midnight_local = _hour_floor(now_local.replace(hour=0))
        try:
            events = homeassistant_adapter.load_entity_history(entity_id, midnight_local, now_local)
            sums, counts = {}, {}
            for event in events:
                try:
                    value = float(event.state)
                except (ValueError, TypeError):
                    continue  # z.B. "unknown"/"unavailable" - diesen Messpunkt auslassen
                hour_local = _hour_floor(event.last_changed.astimezone())
                sums[hour_local] = sums.get(hour_local, 0) + value
                counts[hour_local] = counts.get(hour_local, 0) + 1
            actual_by_hour = {hour: sums[hour] / counts[hour] for hour in sums}
        except Exception as e:
            print("[Shyft] PV-Ist-Werte konnten nicht geladen werden:", repr(e))

    midnight_local = _hour_floor(datetime.now().astimezone().replace(hour=0))
    candidate_hours = set(today_forecast_by_hour) | set(future_forecast_by_hour) | set(actual_by_hour)
    all_hours = {h for h in candidate_hours if h >= midnight_local}
    if not all_hours:
        return jsonify({"status": "success", "labels": [], "forecast": [], "actual": []})

    hour_count = int((max(all_hours) - midnight_local).total_seconds() // 3600) + 1
    labels, forecast, actual = [], [], []
    for i in range(hour_count):
        hour = midnight_local + timedelta(hours=i)
        labels.append(hour.isoformat())
        forecast.append(today_forecast_by_hour.get(hour, future_forecast_by_hour.get(hour)))
        actual.append(actual_by_hour.get(hour))

    return jsonify({"status": "success", "labels": labels, "forecast": forecast, "actual": actual})


def get_wallbox_connection_status_options():
    """Distinct state values known for the mapped "Wallbox: Auto verbunden?" sensor, from three
    sources: (1) HA's own recent history (however much the recorder happens to retain), (2) the
    entity's current live state, so there's always at least one value even right after a HA
    restart with a freshly purged recorder, and (3) if the entity declares its possible values in
    advance (device_class "enum" plus an "options" attribute - not every Wallbox-Integration
    bothers), those too - this can surface a value that simply hasn't occurred yet, so it gets
    classified before it ever causes a silent gap."""
    entity_id = _read_current_config().get("sensorMappings", {}).get("wallbox_plugged", "")
    if not entity_id:
        return []
    values = set()
    try:
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=10)
        for element in homeassistant_adapter.load_entity_history(entity_id, start, end):
            if _is_real_wallbox_state(element.state):
                values.add(element.state)
    except Exception as e:
        print("[Shyft] Wallbox-Status-Historie konnte nicht geladen werden:", repr(e))
    try:
        current_state = homeassistant_adapter.get_from_homeassistant(f"/api/states/{entity_id}")
        state_value = current_state.get("state")
        if _is_real_wallbox_state(state_value):
            values.add(state_value)
        for option in (current_state.get("attributes") or {}).get("options") or []:
            values.add(option)
    except Exception as e:
        print("[Shyft] Aktueller Wallbox-Status konnte nicht geladen werden:", repr(e))
    return sorted(values)


def _is_real_wallbox_state(state_value):
    "Excludes not just the exact HA placeholder states but also glitchy variants (e.g. a transient 'unknown 0' seen from an Easee integration reload) - anything starting with 'unknown' is a placeholder, not a real classifiable status value."
    return bool(state_value) and state_value != "unavailable" and not state_value.startswith("unknown")


@app.route("/wallbox-connection-status-options", methods=["GET"])
def wallboxConnectionStatusOptions():
    return jsonify(get_wallbox_connection_status_options())


# Sammelstelle fuer Konfigurations-Warnhinweise, die oben auf der Konfigurationsseite angezeigt
# werden (siehe readConfigWarnings) - bewusst als Liste kleiner, unabhaengiger Pruefungen gebaut,
# damit sich das zukuenftig zu einer groesseren Sammlung an "muss behoben werden, bevor Shyft
# funktioniert"-Hinweisen ausbauen laesst, ohne die Struktur zu aendern.
def _wallbox_status_mapping_warning(config):
    "Jeder aus Integration/Historie bekannte Statuswert, der noch keiner Ladebereitschaft zugeordnet ist - nicht nur der gerade aktuelle: is_car_ready_to_charge() liefert fuer JEDEN unzugeordneten Wert still False, das blockiert z.B. die PV-Ueberschussladen-Rueckfalllogik ohne jede Fehlermeldung, sobald dieser Wert mal auftritt."
    entity_id = config.get("sensorMappings", {}).get("wallbox_plugged", "")
    if not entity_id:
        return None
    try:
        options = get_wallbox_connection_status_options()
    except Exception as e:
        print("[Shyft] Konfigurations-Warnhinweise: Wallbox-Status-Optionen konnten nicht geladen werden:", repr(e))
        return None
    mapping = config.get("wallboxConnectionStatusMapping", {})
    unmapped = [value for value in options if value not in mapping]
    if not unmapped:
        return None
    return {
        "key": "wallbox_status_unmapped",
        "message": f"Wallbox-Status-Zuordnung unvollständig: {', '.join(unmapped)} noch nicht zugeordnet - betrifft Anwesenheitsprognose und automatische Ladesteuerung (z.B. PV-Überschussladen).",
    }


def compute_config_warnings():
    config = _read_current_config()
    checks = [_wallbox_status_mapping_warning]
    warnings = []
    for check in checks:
        warning = check(config)
        if warning:
            warnings.append(warning)
    return warnings


@app.route("/config/warnings", methods=["GET"])
def readConfigWarnings():
    return jsonify({"warnings": compute_config_warnings()})


# Sensoren, deren Live-Wert in die an shyft-power gesendeten Optimierungsdaten (letztlich die
# input.csv des Optimizers) einfliesst - Schluessel wie in sync_service.LIST_OF_SENSORS, Wert ist
# die deutsche Klartext-Bezeichnung fuer die Fehlerkarte. Nur fuer diese Sensoren meldet
# _read_mapped_entity_state ein "unavailable" als Problem; rein optionale Sensoren duerfen
# unauffaellig fehlen.
HEALTH_MONITORED_SENSOR_KEYS = {
    "photovoltaic_powerflow_pv": "Aktueller Strom - PV",
    "photovoltaic_powerflow_load": "Aktueller Strom - Haushalt",
    "photovoltaic_powerflow_grid": "Aktueller Strom - Netz",
    "photovoltaic_powerflow_battery": "Aktueller Strom - Batterie",
    "battery_state_of_charge": "Ladestand Heimspeicher",
    "heatpump_current_power_elect": "Aktuelle Leistung Waermepumpe",
    "heatpump_temp_indoor_measured": "Innenraumtemperatur (gemessen)",
    "electronicvehicle_state_of_charge": "Auto - Ladestand",
    "wallbox_current_charging_power": "Wallbox - Ladestrom",
}

# Ohne mindestens einen dieser Live-Werte (Bubble-Feldnamen, siehe sync_service.LIST_OF_SENSORS)
# kann shyft-power keine sinnvolle Optimierung fuer die Anlage rechnen.
INPUT_CSV_CORE_BUBBLE_NAMES = {
    "PV - PowerFlow Grid",
    "PV - PowerFlow Load",
    "PV - PowerFlow PV",
}


def _note_sensor_health(sensor_key, entity_id, ok):
    "Meldet bzw. loescht in der Problem-Registry ein 'sensor_unavailable:<entity_id>'-Problem - nur fuer die fuer die input.csv benoetigten Sensoren (siehe HEALTH_MONITORED_SENSOR_KEYS)."
    label = HEALTH_MONITORED_SENSOR_KEYS.get(sensor_key)
    if not label or not entity_id:
        return
    problem_id = f"sensor_unavailable:{entity_id}"
    if ok:
        problem_registry.clear(problem_id)
    else:
        problem_registry.register(
            problem_id,
            f"Der Sensor fuer \"{label}\" ({entity_id}) liefert aktuell keinen Wert (unavailable). "
            f"Solange er fehlt, rechnet shyft-power fuer dieses Geraet mit unvollstaendigen Daten.",
        )


def _update_input_csv_health(config, live_values):
    "Pflegt das Sammelproblem 'input_csv_missing_data' - nur relevant, sobald ueberhaupt ein Wechselrichter zugeordnet ist (vorher ist die fehlende Zuordnung erwartetes Setup, kein Problem)."
    if not config.get("integrationMappings", {}).get("wechselrichter"):
        problem_registry.clear("input_csv_missing_data")
        return
    if any(name in live_values for name in INPUT_CSV_CORE_BUBBLE_NAMES):
        problem_registry.clear("input_csv_missing_data")
        return
    problem_registry.register(
        "input_csv_missing_data",
        "Es fehlen aktuell die grundlegenden Stromfluss-Werte (PV, Haushalt, Netz), die shyft-power "
        "zur Optimierung braucht. Pruefe die Sensor-Zuordnung fuer den Wechselrichter auf der "
        "Konfigurationsseite.",
    )


@app.route("/system-health", methods=["GET"])
def readSystemHealth():
    "Aktuelle Liste laufender, nutzer-relevanter Probleme fuer die Statuskarte oben auf der Konfigurationsseite (siehe problem_registry und renderSystemHealth im Frontend)."
    problems = problem_registry.active_problems()
    visible = problems[:problem_registry.MAX_VISIBLE_PROBLEMS]
    return jsonify({
        "ok": len(problems) == 0,
        "problemCount": len(problems),
        "problems": [
            {"id": p["id"], "message": p["message"], "lastSeen": p.get("lastSeen")}
            for p in visible
        ],
    })


def classify_wallbox_connection_state(state_value, config=None):
    "True = Auto kann laden (physisch eingesteckt), False = Auto kann nicht laden (abwesend), None = vom Nutzer noch nicht zugeordnet"
    config = config or _read_current_config()
    return config.get("wallboxConnectionStatusMapping", {}).get(state_value)


_car_presence_log_lock = threading.Lock()


def sync_car_presence_log():
    "Serialisiert _sync_car_presence_log_impl-Aufrufe - jetzt sowohl vom stuendlichen Cron-Job als auch live vom Websocket-Handler bei jeder Wallbox-Statusaenderung aufgerufen, siehe live_entity_watcher.py."
    with _car_presence_log_lock:
        _sync_car_presence_log_impl()


def _classify_away_state_and_consumption(prev_entry, hour_dt, current_soc, battery_capacity_kwh):
    """Leitet aus dem SOC-Verlauf ab, ob eine abwesende Stunde "steht" oder "unterwegs" war, und
    den dabei verbrauchten Strom (kWh) - dieselbe Zahl unabhängig von der Einfärbung (siehe
    CAR_VAMPIRE_DRAIN_THRESHOLD_PCT_PER_HOUR). Ein SOC-ANSTIEG während der Abwesenheit ist eine
    Fremdladung (Schnelllader o.ä., nicht die eigene Wallbox) - wird komplett ausgeklammert statt
    als "kein/negativer Verbrauch" gezählt, damit weder die Fahrleistungs-Statistik noch die
    Zustands-Klassifikation dadurch verfälscht wird. Gibt (state, consumption_kwh) zurück, beides
    None, wenn sich aus den Daten nichts Belastbares ableiten lässt."""
    if current_soc is None or prev_entry is None:
        return None, None
    prev_soc = prev_entry.get("soc")
    if prev_soc is None:
        return None, None
    try:
        prev_hour_dt = datetime.fromisoformat(prev_entry["hour"])
    except Exception:
        return None, None
    gap_hours = (hour_dt - prev_hour_dt).total_seconds() / 3600
    if gap_hours <= 0 or gap_hours > CAR_PRESENCE_MAX_GAP_HOURS_FOR_DELTA:
        return None, None

    delta_pct = current_soc - prev_soc
    if delta_pct > 0:
        return None, None  # Fremdladung waehrend der Abwesenheit - ausklammern

    drop_pct = -delta_pct
    state = "unterwegs" if drop_pct >= CAR_VAMPIRE_DRAIN_THRESHOLD_PCT_PER_HOUR else "steht"
    consumption_kwh = round(drop_pct / 100 * battery_capacity_kwh, 3) if battery_capacity_kwh else None
    return state, consumption_kwh


# HA's Recorder haelt standardmaessig nur 10 Tage Rohhistorie vor, manche Installationen (wie
# diese hier, geprueft: mind. 30 Tage) laenger - eine laengere Anfrage schadet nicht, HA liefert
# einfach zurueck, was tatsaechlich noch vorhanden ist.
CAR_PRESENCE_BACKFILL_DAYS = 30


def _forward_fill_hourly(events, hours):
    "events: chronologisch sortierte (last_changed, state)-Paare (siehe load_entity_history_raw). Liefert {hour_dt: state}, uebersprungen fuer Stunden, zu denen noch kein state bekannt war (kein Raten vor dem ersten beobachteten Wert)."
    result = {}
    idx = 0
    current_state = None
    have_state = False
    for hour_dt in hours:
        while idx < len(events) and events[idx][0] <= hour_dt:
            current_state = events[idx][1]
            have_state = True
            idx += 1
        if have_state:
            result[hour_dt] = current_state
    return result


def backfill_car_presence_log():
    """Rekonstruiert CAR_PRESENCE_LOG_PATH rueckwirkend aus HA's Sensor-Historie (load_entity_history_raw),
    statt auf organisches Wachstum ueber Wochen zu warten - wird von writeConfig getriggert, sobald
    der Nutzer eine neue/geaenderte wallboxConnectionStatusMapping speichert. Idempotent: kann bei
    jeder Aenderung der Zuordnung gefahrlos erneut laufen (self-healing, wie sync_all_auto_managed_scripts),
    ueberschreibt dabei aber nur den rueckwirkend abgedeckten Zeitraum, nicht bereits live/per Cron
    geloggte neuere Stunden - dieselbe Klassifikationslogik wie _sync_car_presence_log_impl
    (classify_wallbox_connection_state, _classify_away_state_and_consumption), nur rueckwirkend
    stundenweise per Forward-Filling statt live pro Cron-Tick angewendet."""
    config = _read_current_config()
    mapping = config.get("wallboxConnectionStatusMapping", {})
    if not mapping:
        return
    entity_id = config.get("sensorMappings", {}).get("wallbox_plugged", "")
    if not entity_id:
        return

    now_hour = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    start = now_hour - timedelta(days=CAR_PRESENCE_BACKFILL_DAYS)
    hours = [start + timedelta(hours=i) for i in range(int((now_hour - start).total_seconds() // 3600))]

    try:
        wallbox_events = homeassistant_adapter.load_entity_history_raw(entity_id, start, now_hour)
    except Exception as e:
        print("[Shyft] Anwesenheits-Backfill: Wallbox-Historie konnte nicht geladen werden:", repr(e))
        return
    wallbox_by_hour = _forward_fill_hourly(wallbox_events, hours)

    soc_entity_id = config.get("sensorMappings", {}).get("electronicvehicle_state_of_charge", "")
    soc_by_hour = {}
    if soc_entity_id:
        try:
            soc_events = homeassistant_adapter.load_entity_history_raw(soc_entity_id, start, now_hour)
            for hour_dt, soc_state in _forward_fill_hourly(soc_events, hours).items():
                try:
                    soc_by_hour[hour_dt] = float(soc_state)
                except (TypeError, ValueError):
                    pass
        except Exception as e:
            print("[Shyft] Anwesenheits-Backfill: SOC-Historie konnte nicht geladen werden:", repr(e))

    battery_capacity_kwh = config.get("carBatteryCapacityKwh")

    prev_entry = None
    new_entries = []
    for hour_dt in hours:
        state_value = wallbox_by_hour.get(hour_dt)
        if state_value is None:
            continue
        connected = mapping.get(state_value)
        if connected is None:
            continue  # noch nicht zugeordneter Statuswert - ueberspringen statt raten, wie beim Live-Sync
        current_soc = soc_by_hour.get(hour_dt)
        entry = {"hour": hour_dt.isoformat(), "connected": connected, "soc": current_soc}
        if not connected:
            state, consumption_kwh = _classify_away_state_and_consumption(prev_entry, hour_dt, current_soc, battery_capacity_kwh)
            if state is not None:
                entry["state"] = state
            if consumption_kwh is not None:
                entry["consumption_kwh"] = consumption_kwh
        new_entries.append(entry)
        prev_entry = entry

    with _car_presence_log_lock:
        try:
            with open(CAR_PRESENCE_LOG_PATH, "r") as f:
                log = json.load(f)
        except Exception:
            log = []
        # der Backfill ist fuer den abgedeckten Zeitraum autoritativ - vorhandene, ggf. noch mit
        # einer unvollstaendigen Zuordnung geloggte Eintraege darin werden ersetzt
        start_iso = start.isoformat()
        now_hour_iso = now_hour.isoformat()
        log = [e for e in log if not (start_iso <= e.get("hour", "") < now_hour_iso)]
        log.extend(new_entries)
        cutoff = (datetime.now(timezone.utc) - timedelta(days=CAR_PRESENCE_LOG_MAX_DAYS)).isoformat()
        log = [e for e in log if e.get("hour", "") >= cutoff]
        log.sort(key=lambda e: e["hour"])

        try:
            with open(CAR_PRESENCE_LOG_PATH, "w") as f:
                json.dump(log, f)
        except Exception as e:
            print("[Shyft] Anwesenheits-Backfill konnte nicht gespeichert werden:", repr(e))
            return

    print(f"[Shyft] Anwesenheits-Backfill: {len(new_entries)} von {len(hours)} moeglichen Stunden aus der Historie rekonstruiert.")


def _sync_car_presence_log_impl():
    """Hourly snapshot of the classified Wallbox-Verbindungsstatus (siehe
    classify_wallbox_connection_state) - die Grundlage der Anwesenheitsprognose. Ein noch nicht
    zugeordneter Statuswert wird übersprungen statt geraten, damit die Historie nicht mit falschen
    Labels verunreinigt wird. Solange nicht eingesteckt, wird zusätzlich der Autobatterie-SOC
    mitgeloggt (siehe _classify_away_state_and_consumption) - Grundlage für die Fahrverhalten-/
    Verbrauchsprognose. Der SOC wird IMMER mitgeloggt (auch eingesteckt, siehe unten der Vollständigkeit
    halber - Ladevorgänge selbst fließen nicht in die Verbrauchsschätzung ein, siehe oben), damit
    für jede Stunde ein Vorwert für die Delta-Berechnung existiert. Vampire Drain kann übrigens
    auch bei eingestecktem, aber gerade nicht ladendem Stecker auftreten - das ändert nichts an der
    Klassifikation "eingesteckt", nur die Konsequenz "kein State/kein Verbrauch wird dafür berechnet"."""
    config = _read_current_config()
    entity_id = config.get("sensorMappings", {}).get("wallbox_plugged", "")
    if not entity_id:
        return
    try:
        current = homeassistant_adapter.load_entity_state(entity_id)
    except Exception as e:
        print("[Shyft] Anwesenheits-Log: Wallbox-Status konnte nicht gelesen werden:", repr(e))
        return

    connected = classify_wallbox_connection_state(current.state, config)
    if connected is None:
        return

    hour_dt = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    hour_iso = hour_dt.isoformat()
    try:
        with open(CAR_PRESENCE_LOG_PATH, "r") as f:
            log = json.load(f)
    except Exception:
        log = []

    prev_entry = max((e for e in log if e.get("hour", "") < hour_iso), key=lambda e: e["hour"], default=None)

    soc_entity_id = config.get("sensorMappings", {}).get("electronicvehicle_state_of_charge", "")
    current_soc = None
    if soc_entity_id:
        try:
            current_soc = homeassistant_adapter.read_entity_numeric_value(soc_entity_id)
        except Exception:
            current_soc = None

    entry = {"hour": hour_iso, "connected": connected, "soc": current_soc}
    if not connected:
        battery_capacity_kwh = config.get("carBatteryCapacityKwh")
        state, consumption_kwh = _classify_away_state_and_consumption(prev_entry, hour_dt, current_soc, battery_capacity_kwh)
        if state is not None:
            entry["state"] = state
        if consumption_kwh is not None:
            entry["consumption_kwh"] = consumption_kwh

    log = [e for e in log if e.get("hour") != hour_iso]
    log.append(entry)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=CAR_PRESENCE_LOG_MAX_DAYS)).isoformat()
    log = [e for e in log if e.get("hour", "") >= cutoff]
    log.sort(key=lambda e: e["hour"])

    try:
        with open(CAR_PRESENCE_LOG_PATH, "w") as f:
            json.dump(log, f)
    except Exception as e:
        print("[Shyft] Anwesenheits-Log konnte nicht gespeichert werden:", repr(e))


def away_return_ceiling(hours_away):
    """Feste Sicherheits-Heuristik, unabhängig von der gelernten Tabelle: innerhalb einer normalen
    Tages-Abwesenheit (bis CAR_PRESENCE_AWAY_GRACE_HOURS) keine Einschränkung, danach halbiert
    sich die zulässige Rückkehrwahrscheinlichkeit je weitere CAR_PRESENCE_AWAY_HALF_LIFE_HOURS -
    greift auch dann, wenn die Tabelle mangels Beobachtung (z.B. beim allerersten Urlaub)
    fälschlich eine hohe Rückkehrwahrscheinlichkeit vorschlagen würde."""
    if hours_away <= CAR_PRESENCE_AWAY_GRACE_HOURS:
        return 1.0
    decayed = 0.5 ** ((hours_away - CAR_PRESENCE_AWAY_GRACE_HOURS) / CAR_PRESENCE_AWAY_HALF_LIFE_HOURS)
    return max(CAR_PRESENCE_AWAY_CEILING_FLOOR, decayed)


def car_soc_connect_factor(soc_percent):
    "Je leerer der Akku, desto eher wird eingesteckt - bewusst nur ein begrenzter Faktor (siehe CAR_PRESENCE_SOC_INFLUENCE)."
    soc_percent = max(0.0, min(100.0, soc_percent))
    return 1 + CAR_PRESENCE_SOC_INFLUENCE * (1 - soc_percent / 100)


def compute_hours_away(by_hour, current_connected, now_hour):
    "Anzahl zusammenhängender Stunden (rückwärts ab jetzt), die das Auto als abwesend geloggt ist - stoppt bei der ersten geloggten Anwesenheit oder einer Lücke im Log (die könnte eine unbeobachtete Rückkehr verbergen)."
    if current_connected is not False:
        return 0
    hours = 1
    cursor = now_hour - timedelta(hours=1)
    while by_hour.get(cursor) is False:
        hours += 1
        cursor -= timedelta(hours=1)
    return hours


# Cold-Start-Defaults, bevor genug eigene Fahrhistorie existiert - bewusst konservativ (die
# meisten abwesenden Stunden sind Standzeit anderswo, nicht aktives Fahren) statt eine Zahl ohne
# Datengrundlage vorzutäuschen.
CAR_DRIVING_FRACTION_DEFAULT = 0.15
CAR_CONSUMPTION_DEFAULT_KWH = 0.0


def compute_car_presence_forecast(hours=48):
    """Builds an hours-ahead (default 48h), hourly Anwesenheits- UND Fahrverhalten-/Verbrauchsprognose aus
    CAR_PRESENCE_LOG_PATH. Der eingesteckt/abwesend-Teil ist eine time-inhomogene Markov-Kette
    (Wochentag, Stunde, aktueller Zustand), forward-simuliert ab dem live beobachteten Zustand -
    unverändert gegenüber der ursprünglichen Anwesenheitsprognose. Zusätzlich wird jede als
    "abwesend" geloggte Stunde (siehe _classify_away_state_and_consumption) in "steht" vs.
    "unterwegs" aufgeteilt: die abwesend-Wahrscheinlichkeit einer Stunde wird mit dem historischen
    Anteil "unterwegs" an diesem (Wochentag, Stunde)-Bucket multipliziert (reine Randverteilung,
    kein eigenes Markov-Modell - "innerhalb der bestehenden Pipeline", nicht komplexer als nötig),
    und die erwarteten kWh sind diese Wahrscheinlichkeit mal der historisch durchschnittliche
    Verbrauch in diesem Bucket. Ein Bucket mit zu wenigen historischen Beobachtungen fällt auf eine
    gröbere Ebene zurück statt eine unsichere Zahl vorzutäuschen."""
    try:
        with open(CAR_PRESENCE_LOG_PATH, "r") as f:
            log = json.load(f)
    except Exception:
        log = []

    entries = []
    for item in log:
        try:
            entries.append((datetime.fromisoformat(item["hour"]), bool(item["connected"]), item))
        except Exception:
            continue
    entries.sort(key=lambda e: e[0])
    by_hour = {ts: connected for ts, connected, _ in entries}

    transitions_by_state = {}  # (weekday, hour, from_connected) -> [outcomes]
    marginal = {}              # (weekday, hour) -> [outcomes]
    overall = []
    away_state_counts = {}     # (weekday, hour) -> {"steht": n, "unterwegs": n}
    consumption_samples = {}   # (weekday, hour) -> [kWh, nur "unterwegs"]
    overall_away_states = []   # alle "steht"/"unterwegs"-Labels, fuer den globalen Fallback-Anteil
    overall_consumption = []   # alle kWh-Werte "unterwegs", fuer den globalen Fallback-Durchschnitt

    for ts, connected, item in entries:
        overall.append(connected)
        marginal.setdefault((ts.weekday(), ts.hour), []).append(connected)
        next_ts = ts + timedelta(hours=1)
        if next_ts in by_hour:
            transitions_by_state.setdefault((ts.weekday(), ts.hour, connected), []).append(by_hour[next_ts])

        away_state = item.get("state")
        if not connected and away_state in ("steht", "unterwegs"):
            bucket = away_state_counts.setdefault((ts.weekday(), ts.hour), {"steht": 0, "unterwegs": 0})
            bucket[away_state] += 1
            overall_away_states.append(away_state)
            consumption_kwh = item.get("consumption_kwh")
            if away_state == "unterwegs" and consumption_kwh is not None:
                consumption_samples.setdefault((ts.weekday(), ts.hour), []).append(consumption_kwh)
                overall_consumption.append(consumption_kwh)

    overall_rate = (sum(overall) / len(overall)) if overall else 0.5
    overall_driving_fraction = (
        overall_away_states.count("unterwegs") / len(overall_away_states)
        if overall_away_states else CAR_DRIVING_FRACTION_DEFAULT
    )
    overall_avg_consumption = (
        sum(overall_consumption) / len(overall_consumption)
        if overall_consumption else CAR_CONSUMPTION_DEFAULT_KWH
    )

    # Jede *_rate/*_fraction-Funktion gibt zusaetzlich zurueck, ob sie auf die groebere
    # Fallback-Ebene ausweichen musste (zu wenige Beobachtungen fuer diesen konkreten
    # (Wochentag, Stunde)-Bucket) - das speist low_data_basis unten, damit der Nutzer im Dashboard
    # sieht, welche Stunden noch auf einer duennen Datenbasis stehen, statt eine vermeintlich
    # praezise Zahl ohne Kontext zu zeigen.
    def marginal_rate(weekday, hour):
        samples = marginal.get((weekday, hour), [])
        if len(samples) >= CAR_PRESENCE_MIN_SAMPLES:
            return sum(samples) / len(samples), False
        return overall_rate, True

    def transition_rate(weekday, hour, from_connected):
        samples = transitions_by_state.get((weekday, hour, from_connected), [])
        if len(samples) >= CAR_PRESENCE_MIN_SAMPLES:
            return sum(samples) / len(samples), False
        rate, _ = marginal_rate(weekday, hour)
        return rate, True

    def driving_fraction(weekday, hour):
        counts = away_state_counts.get((weekday, hour))
        total = (counts["steht"] + counts["unterwegs"]) if counts else 0
        if not counts or total < CAR_PRESENCE_MIN_SAMPLES:
            return overall_driving_fraction, True
        return counts["unterwegs"] / total, False

    def expected_consumption_when_driving(weekday, hour):
        samples = consumption_samples.get((weekday, hour), [])
        if len(samples) < CAR_PRESENCE_MIN_SAMPLES:
            return overall_avg_consumption, True
        return sum(samples) / len(samples), False

    config = _read_current_config()
    sensor_mappings = config.get("sensorMappings", {})

    entity_id = sensor_mappings.get("wallbox_plugged", "")
    current_connected = None
    if entity_id:
        try:
            current_state = homeassistant_adapter.load_entity_state(entity_id)
            current_connected = classify_wallbox_connection_state(current_state.state, config)
        except Exception as e:
            print("[Shyft] Anwesenheitsprognose: aktueller Wallbox-Status konnte nicht gelesen werden:", repr(e))

    soc_entity_id = sensor_mappings.get("electronicvehicle_state_of_charge", "")
    soc_factor = 1.0
    if soc_entity_id:
        try:
            soc_factor = car_soc_connect_factor(homeassistant_adapter.read_entity_numeric_value(soc_entity_id))
        except Exception as e:
            print("[Shyft] Anwesenheitsprognose: Akkustand konnte nicht gelesen werden:", repr(e))

    start = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    labels = [(start + timedelta(hours=i)).isoformat() for i in range(hours)]
    hours_away_now = compute_hours_away(by_hour, current_connected, start)

    probabilities = []
    low_data_basis = []
    if current_connected is None:
        p, fb0 = marginal_rate(start.weekday(), start.hour)
    else:
        p, fb0 = (1.0 if current_connected else 0.0), False
    probabilities.append(p)
    low_data_basis.append(fb0)
    for i in range(1, hours):
        source_ts = start + timedelta(hours=i - 1)
        p_home_given_home, fb_home = transition_rate(source_ts.weekday(), source_ts.hour, True)
        p_home_given_away, fb_away = transition_rate(source_ts.weekday(), source_ts.hour, False)
        p_home_given_away *= soc_factor
        if hours_away_now > 0:
            p_home_given_away = min(p_home_given_away, away_return_ceiling(hours_away_now + i))
        p_home_given_away = min(1.0, p_home_given_away)
        p = p * p_home_given_home + (1 - p) * p_home_given_away
        probabilities.append(p)
        low_data_basis.append(fb_home or fb_away)

    standing_probabilities = []
    driving_probabilities = []
    consumption_kwh_forecast = []
    for i in range(hours):
        ts_i = start + timedelta(hours=i)
        p_away = 1 - probabilities[i]
        frac_driving, fb_driving = driving_fraction(ts_i.weekday(), ts_i.hour)
        p_driving = p_away * frac_driving
        p_standing = p_away * (1 - frac_driving)
        standing_probabilities.append(p_standing)
        driving_probabilities.append(p_driving)
        avg_consumption, fb_consumption = expected_consumption_when_driving(ts_i.weekday(), ts_i.hour)
        consumption_kwh_forecast.append(p_driving * avg_consumption)
        low_data_basis[i] = low_data_basis[i] or fb_driving or fb_consumption

    return labels, probabilities, standing_probabilities, driving_probabilities, consumption_kwh_forecast, low_data_basis


# Away-probability (1 - P(connected)) from which an hour counts as "car not at the wallbox" for
# ev_usage_h - see build_ev_optimizer_fields.
EV_AWAY_THRESHOLD = 0.5


def build_ev_optimizer_fields(config, optimizer_period=48):
    """Builds the ev_usage_h/d_ev_kwh fields shyft's Java optimizer expects (see
    ExternalOptimizerInput.evUsageH/dEvKwh and EVDemandList in the shyft repo), sourced from our
    own compute_car_presence_forecast() instead of a Bubble TimeScheduleEntity.

    Returns {} if no EV/wallbox integration is configured (matches configured("auto") in
    compute_energy_flow_data) - Julia's isempty(ev_usage_h) check then correctly excludes the EV
    from optimization, same as before.

    Otherwise returns:
      - "ev_usage_h": compact ";"-joined list of 1-based hour indices where the car is more
        likely away than connected (>= EV_AWAY_THRESHOLD), mirroring EVDemandList.getValue(lineNumber)'s
        packed-index format - NOT a per-hour-aligned vector.
      - "d_ev_kwh": ";"-joined per-hour expected consumption (kWh), one value per hour, dense
        (every hour has a value, mostly close to zero) - mirrors EVDemandList.getValue(datetime).
      - "baseTime": ISO timestamp of the first hour (hour 1), so Java can re-align if processing
        slips into the next full hour before this reaches the optimizer.

    optimizer_period is the site's (variable) optimization horizon in hours (see "Optimization
    Periods Site" in staticConfig, default 48). We compute one extra hour (optimizer_period + 1)
    as a buffer for that same clock-drift reason.

    If nothing crosses EV_AWAY_THRESHOLD within optimizer_period, Julia would otherwise treat this
    as "no EV" (isempty(ev_usage_h)) and disable charging entirely even though a car IS configured
    - see the isempty(ev_usage_h) bypass in run_SHEMS.jl. To avoid that false negative, we force in
    the single most-likely-away hour (within optimizer_period, not the buffer hour) when the
    threshold catches nothing.
    """
    has_ev = bool(config.get("integrationMappings", {}).get("auto"))
    if not has_ev:
        return {}

    hours = optimizer_period + 1
    labels, probabilities, _, _, consumption_kwh_forecast, _ = compute_car_presence_forecast(hours=hours)

    away_probabilities = [1 - p for p in probabilities]
    usage_hours_zero_based = [i for i in range(hours) if away_probabilities[i] >= EV_AWAY_THRESHOLD]

    # Fallback only looks within optimizer_period (not the buffer hour) - see docstring.
    if not any(i < optimizer_period for i in usage_hours_zero_based):
        most_likely_away = max(range(optimizer_period), key=lambda i: away_probabilities[i])
        usage_hours_zero_based.append(most_likely_away)
        usage_hours_zero_based.sort()

    ev_usage_h = ";".join(str(i + 1) for i in usage_hours_zero_based)
    d_ev_kwh = ";".join(f"{v:.3f}" for v in consumption_kwh_forecast)

    return {
        "ev_usage_h": ev_usage_h,
        "d_ev_kwh": d_ev_kwh,
        "baseTime": labels[0],
    }


@app.route("/dashboard/car-presence-forecast", methods=["GET"])
def carPresenceForecast():
    labels, probabilities, standing_probabilities, driving_probabilities, consumption_kwh_forecast, low_data_basis = compute_car_presence_forecast()
    return jsonify({
        "status": "success",
        "labels": labels,
        "probabilities": [round(p, 3) for p in probabilities],
        "standingProbabilities": [round(p, 3) for p in standing_probabilities],
        "drivingProbabilities": [round(p, 3) for p in driving_probabilities],
        "consumptionKwh": [round(v, 3) for v in consumption_kwh_forecast],
        "lowDataBasis": low_data_basis,
    })


def mapToResponse(response):
    result = []
    for item in response:
        attributes = item.get("attributes", {})
        unitOfMeasurement = attributes.get("unit_of_measurement", "")
        stateAndUnit = item["state"] + " " + unitOfMeasurement if unitOfMeasurement else item["state"]
        result.append({
            "entity_id": item["entity_id"],
            "label": item["entity_id"] + " (" + stateAndUnit + ")",
            "device_class": attributes.get("device_class", ""),
            "state": item["state"],
            "unit": unitOfMeasurement,
        })
    return jsonify(result)


def build_number_script_config(entity_id, control):
    "Builds a script that sets entity_id to a target_value passed in at call time - mirrors blueprints/heizung_soll_temperatur.yaml"
    domain = entity_id.split(".")[0]
    if domain == "number":
        action = {
            "action": "number.set_value",
            "target": {"entity_id": entity_id},
            "data": {"value": "{{ target_value }}"}
        }
    elif domain == "climate":
        action = {
            "action": "climate.set_temperature",
            "target": {"entity_id": entity_id},
            "data": {"temperature": "{{ target_value }}"}
        }
    else:
        return None

    return {
        "alias": control["script_alias"],
        "fields": {
            "target_value": {
                "name": control["field_label"],
                "description": control["field_description"],
                "selector": {"number": {"min": control["min"], "max": control["max"], "step": control["step"]}}
            }
        },
        "sequence": [action]
    }


def sync_number_script(control_key, entity_id):
    "Creates/updates or removes an auto-managed control's script so it always targets the currently mapped entity. Returns the resulting actorMappings value."
    control = AUTO_MANAGED_CONTROLS[control_key]
    script_id = control["script_id"]
    if not entity_id:
        homeassistant_adapter.delete_script_config(script_id)
        homeassistant_adapter.call_service("script", "reload")
        return ""

    config = build_number_script_config(entity_id, control)
    if config is None:
        raise Exception(f"Entity {entity_id} ist weder eine number- noch eine climate-Entity")

    homeassistant_adapter.put_script_config(script_id, config)
    # writing the config alone doesn't make HA (re-)register the script entity - it needs an explicit reload
    homeassistant_adapter.call_service("script", "reload")
    return f"script.{script_id}"


def sync_all_auto_managed_scripts():
    "Re-creates every number-type auto-managed script against its currently mapped entity - run at startup so a HA restart or a manually deleted script self-heals without needing a config save."
    config = _read_current_config()
    sensor_mappings = config.get("sensorMappings", {})
    for control_key, control in AUTO_MANAGED_CONTROLS.items():
        if control["type"] != "number" or control_key in AUTOMATION_ONLY_CONTROL_KEYS:
            continue
        try:
            sync_number_script(control_key, sensor_mappings.get(control["sensor_field"], ""))
        except Exception as e:
            print(f"[Shyft] Startup-Sync fuer '{control_key}' fehlgeschlagen:", repr(e))


def execute_auto_managed_action(control_key, phase, target_value):
    """Executes the concrete Start/Ende-Verhalten for an AUTO_MANAGED_CONTROLS Aktionstyp - either
    "direct" (the addon writes the mapped entity itself, the original/default behavior) or
    "ha_automation" (the addon triggers the user's own automation instead - see controlVariant in
    the config and trigger_ha_automation)."""
    config = _read_current_config()
    control = AUTO_MANAGED_CONTROLS[control_key]
    variant = resolve_control_variant(control_key, config)

    if variant == "ha_automation":
        actor_mappings = config.get("actorMappings", {})
        if control["type"] == "number":
            if phase != "start":
                return  # no Ende-Verhalten defined yet for direct-value controls either
            trigger_ha_automation(actor_mappings.get(control_key), "start", target_value)
        elif control["type"] == "switch":
            # two independent automations (not one automation + a "phase" variable like elsewhere)
            # since the user asked for that shape specifically for "Sonstiger Verbraucher"
            actor_key = "consumer_on" if phase == "start" else "consumer_off"
            trigger_ha_automation(actor_mappings.get(actor_key), phase, target_value)
        return

    entity_id = config.get("sensorMappings", {}).get(control["sensor_field"], "")
    if not entity_id:
        raise Exception(f"Keine Entity fuer '{control_key}' zugeordnet")

    if control["type"] == "number":
        if phase != "start":
            return  # no Ende-Verhalten defined yet for direct-value controls - a later step may add one
        if target_value is None:
            raise Exception("Aktion enthaelt keinen Zielwert (Target Value)")
        homeassistant_adapter.call_service("script", control["script_id"], {"target_value": target_value})
    elif control["type"] == "switch":
        service = "turn_on" if phase == "start" else "turn_off"
        homeassistant_adapter.call_service("homeassistant", service, {"entity_id": entity_id})


# Assumptions behind the kW -> Phasen/Ampere conversion for "Auto laden" (not yet configurable):
# 230V per phase (standard German residential connection), a 16A single-phase ceiling before
# switching to 3-phase, and the IEC 61851 6A EV charging minimum. shyft-power's own wallbox power
# constraints (e.g. max charging power) aren't transmitted to the addon yet - a later step.
CHARGING_PHASE_VOLTAGE = 230
CHARGING_MIN_AMPS = 6
CHARGING_SINGLE_PHASE_MAX_AMPS = 16


def compute_charging_phases_and_amps(target_kw):
    "Converts shyft-power's kW Target Value for 'Auto laden' into a phase count + Ampere for the wallbox. Always rounds up so the result never falls below the 6A EV charging minimum."
    if target_kw is None:
        raise Exception("Aktion enthaelt keinen Zielwert (Target Value)")
    single_phase_amps = math.ceil(target_kw * 1000 / CHARGING_PHASE_VOLTAGE)
    if single_phase_amps <= CHARGING_SINGLE_PHASE_MAX_AMPS:
        return 1, max(CHARGING_MIN_AMPS, single_phase_amps)
    three_phase_amps = math.ceil(target_kw * 1000 / (3 * CHARGING_PHASE_VOLTAGE))
    return 3, max(CHARGING_MIN_AMPS, three_phase_amps)


def get_integration_device_id(integration_key):
    "Best-effort device id of the currently selected integration's own device (e.g. 'wallbox', 'waermepumpe') - mirrors getIntegrationDevices() in app.js, used server-side as a fallback when a stored device_id is missing."
    config = _read_current_config()
    selected_ids = config.get("integrationMappings", {}).get(integration_key, [])
    if not selected_ids:
        return None
    try:
        device_map = homeassistant_adapter.get_integrations_and_entities().get("deviceMap", {})
    except Exception as e:
        print(f"[Shyft] Konnte Geraet fuer '{integration_key}' nicht ermitteln:", repr(e))
        return None
    for entry_id in selected_ids:
        devices = device_map.get(entry_id) or []
        if devices:
            return devices[0]["id"]
    return None


class RecipeCallError(Exception):
    "Raised when a configured 'Auto laden' service call itself fails, carrying what was actually sent (service + data) so log_error_to_shyft can report it precisely."
    def __init__(self, message, service, data):
        super().__init__(message)
        self.service = service
        self.data = data


def classify_error(message):
    "Best-effort categorization of an exception message into a fixed set of error_type values for log_error_to_shyft, based on the wording the addon's own exceptions consistently use."
    lower = (message or "").lower()
    if "konfiguriert" in lower or "zugeordnet" in lower or "ausgewählt" in lower:
        return "not_configured"
    if "nicht lesbar" in lower or "liefert keinen" in lower:
        return "unreadable_value"
    if "failed:" in lower or "service" in lower:
        return "service_call_failed"
    return "unexpected_error"


def log_error_to_shyft(context, error_type, error_message, service_called=None, data_sent=None):
    """Best-effort error report to shyft-power, sent whenever a Test-Button click in the addon
    returns an error - lets shyft-power's team see integration failures across users without
    needing addon log access. Never raises: a failed report shouldn't break the actual test
    response the user is waiting on.
    """
    user_id = extract_shyft_user_id(shyft_adapter.bubble_token)
    if not user_id:
        return
    meta = f"addon_version={VERSION}; context={context}; service_called={service_called or ''}; timestamp={datetime.now(timezone.utc).isoformat()}"
    payload = {
        "user": user_id,
        "meta": meta,
        "error_type": error_type,
        "error_message": error_message,
    }
    if data_sent is not None:
        payload["data_sent"] = data_sent
    try:
        shyft_adapter.send_error_log(payload)
    except Exception as e:
        print("[Shyft] Fehlerreport an shyft-power fehlgeschlagen:", repr(e))


def call_recipe_stage(stage, branch_key=None, extra_data=None, integration_key="wallbox"):
    """Calls one configured recipe stage's Home Assistant service (e.g. an "Auto laden" stage, or
    the single-stage "Warmwasserbereitung aktivieren" recipe) with its shared fields (the same for
    every call, e.g. device_id) plus whichever branch-specific fields apply for branch_key (e.g.
    phaseCount's "1"/"3", or control's "start"/"stop") - see buildBranchedStageFields in app.js for
    how these are configured. A field only needs a branch split at all if it has a fixed set of
    choices (a Home Assistant "select" selector) that differs by branch, e.g. easee.action_command's
    action_command being "start" vs "stop"; static fields like device_id are the same in
    sharedFields regardless of branch. extra_data overrides on top of that - used by the amperage
    stage to inject the freshly computed Ampere value into each of its configured amountFields,
    since a service can have more than one number field (e.g. Easee's set_charger_dynamic_limit
    also has a time_to_live) and only some of them mean "current". integration_key picks which
    integration's device to fall back to for an empty device_id (see integration_key below).
    """
    service = (stage or {}).get("service", "")
    if not service or "." not in service:
        raise Exception("Kein Befehl (Service) konfiguriert")
    domain, service_name = service.split(".", 1)

    data = dict((stage.get("sharedFields") or {}))
    data.update((stage.get("branchFields") or {}).get(branch_key, {}))
    if extra_data:
        data.update(extra_data)

    # safety net: the frontend fills device_id in from the selected integration's own device at
    # save time, but a config saved before that existed (or before a device was detectable) can
    # still have it empty - re-derive it fresh here rather than depending on a re-triggered save
    if not data.get("device_id"):
        fallback_device_id = get_integration_device_id(integration_key)
        if fallback_device_id:
            data["device_id"] = fallback_device_id

    print(f"[Shyft] Rufe {domain}.{service_name} auf mit Daten {data}")
    try:
        homeassistant_adapter.call_service(domain, service_name, data)
    except Exception as e:
        # Home Assistant's own response usually has no more detail than this for a 500 (the real
        # traceback - e.g. from a bug in the integration's own service handler - only shows up in
        # Home Assistant Core's own log, not in the REST response) - logging what we actually sent
        # at least lets you cross-reference the two.
        print(f"[Shyft] {domain}.{service_name} fehlgeschlagen: {e!r}")
        raise RecipeCallError(str(e), service, data) from e


# Gives the wallbox time to actually process one step before the next follows - without this,
# e.g. "Ladevorgang starten" can race ahead of the phase switch on some wallboxes (observed in a
# real test where the phase switch was silently dropped when the calls came in back-to-back).
CHARGING_STAGE_DELAY_SECONDS = 10


def needs_stop_before_phase_change(target_kw):
    """A wallbox can only change its phase count while it isn't actively charging - starting a new
    charge whose phase count differs from whatever's currently running needs a stop-wait-restart
    first, or the phase switch silently fails to apply. Compares the phase count the CURRENTLY
    reported charging power falls into (via the "Wallbox - Ladestrom" sensor, sensorMappings key
    wallbox_current_charging_power) against the new target's, using the same 1-vs-3-phase
    threshold as compute_charging_phases_and_amps, so the two stay in sync by construction rather
    than duplicating the ~4kW cutoff as a separate magic number. If that sensor isn't configured or
    its value isn't a number, defaults to True (safer to always stop first than to risk a phase
    switch mid-charge) - matching what happens anyway when there's genuinely nothing charging yet:
    a "stop" call on an idle wallbox is a harmless no-op.
    """
    config = _read_current_config()
    entity_id = config.get("sensorMappings", {}).get("wallbox_current_charging_power", "")
    if not entity_id:
        return True
    try:
        current_kw = homeassistant_adapter.read_entity_numeric_value(entity_id)
    except Exception:
        return True
    current_phases, _ = compute_charging_phases_and_amps(current_kw)
    new_phases, _ = compute_charging_phases_and_amps(target_kw)
    return current_phases != new_phases


def trigger_ha_automation(automation_entity_id, phase, target):
    """Triggers the user's own automation with target/phase as template variables ({{ target }},
    {{ phase }}) instead of the addon driving individual services itself - lets the user implement
    arbitrary logic Home Assistant-side. Confirmed via Home Assistant's own source that
    automation.trigger's "variables" field does populate custom keys like this correctly (the one
    known bug is specific to the reserved "trigger" variable, not custom ones like these)."""
    if not automation_entity_id:
        raise Exception("Keine Automation ausgewählt")
    homeassistant_adapter.call_service("automation", "trigger", {
        "entity_id": automation_entity_id,
        "variables": {"target": target, "phase": phase},
    })


def trigger_ha_automation_recipe(recipe, phase, target_kw):
    "Runs a car-charge-style recipe's 'HA-Automation' variant - see trigger_ha_automation."
    trigger_ha_automation(recipe.get("haAutomationEntityId"), phase, target_kw)


def execute_car_charge_start(target_kw):
    config = _read_current_config()
    # Gilt fuer JEDEN Aufrufer (die lokale PV-Ueberschussladen-Rueckfalllogik UND shyft-powers
    # eigene "Auto laden"-Cloud-Aktionen, siehe handle_shyft_action_start) - beide koennen einen zu
    # hohen Zielwert anfordern, und die Wallbox soll so oder so nie mehr bekommen, als sie selbst
    # zulaesst (siehe compute_wallbox_max_kw).
    if target_kw is not None:
        target_kw = min(target_kw, compute_wallbox_max_kw(config))
    recipe = config.get("carChargeRecipe", {})
    recipe_type = recipe.get("type")

    if recipe_type == "ha_automation":
        trigger_ha_automation_recipe(recipe, "start", target_kw)
        return
    if recipe_type != "three_stage":
        raise Exception("Kein Lade-Rezept konfiguriert")

    if needs_stop_before_phase_change(target_kw):
        call_recipe_stage(recipe.get("control", {}), branch_key="stop")
        time.sleep(CHARGING_STAGE_DELAY_SECONDS)

    phases, amps = compute_charging_phases_and_amps(target_kw)
    call_recipe_stage(recipe.get("phaseCount", {}), branch_key=str(phases))
    time.sleep(CHARGING_STAGE_DELAY_SECONDS)

    amperage_stage = recipe.get("amperage", {})
    amount_fields = amperage_stage.get("amountFields") or []
    if not amount_fields:
        raise Exception("Kein Feld für die Amperezahl konfiguriert")
    call_recipe_stage(amperage_stage, extra_data={f: amps for f in amount_fields})
    time.sleep(CHARGING_STAGE_DELAY_SECONDS)

    call_recipe_stage(recipe.get("control", {}), branch_key="start")


def execute_car_charge_stop(target_kw=None):
    config = _read_current_config()
    recipe = config.get("carChargeRecipe", {})
    if recipe.get("type") == "ha_automation":
        trigger_ha_automation_recipe(recipe, "stop", target_kw)
        return
    call_recipe_stage(recipe.get("control", {}), branch_key="stop")


# PV-Überschussladen-Rückfalllogik: shyft-power schickt eigene "Auto laden"-Aktionen mit
# Subtitle "PV-Überschussladen", basierend auf seiner PV-Prognose - die kann daneben liegen. Diese
# Rückfalllogik beobachtet den tatsächlichen Netz-Sensor direkt und greift unabhängig davon ein,
# ob shyft-power selbst gerade eine "Auto laden"-Aktion laufen hat (siehe run_pv_surplus_charging_tick).
PV_SURPLUS_MIN_KW = CHARGING_MIN_AMPS * CHARGING_PHASE_VOLTAGE / 1000  # 6A/1-phasig als Untergrenze

# compute_wallbox_max_kw lebt jetzt in sync_service.py (siehe Import oben) - collect_static_config
# braucht dieselbe Berechnung fuers addon_sensor_data_JSON ("WB - Max Charging Power"), ohne dass
# sync_service.py dafuer aus app.py importieren muesste (Zirkelimport, app.py importiert bereits
# aus sync_service.py).


def read_grid_power_kw(config):
    "Aktuelle Netzeinspeisung/-bezug in kW (negativ = Einspeisung) - konvertiert die Home-Assistant-Einheit (z.B. W) wie sync_service es auch fuer shyft-power tut. None, wenn kein Sensor zugeordnet oder nicht lesbar."
    entity_id = config.get("sensorMappings", {}).get("photovoltaic_powerflow_grid", "")
    if not entity_id:
        return None
    try:
        state = homeassistant_adapter.load_entity_state(entity_id)
        value, _ = convert_to_expected_unit("photovoltaic_powerflow_grid", state.state, state.unit)
        return float(value)
    except Exception:
        return None


def read_home_battery_soc(config):
    "Aktueller Heimspeicher-SOC in %, oder None, wenn kein Sensor zugeordnet, unavailable/unknown, oder nicht lesbar - das ist gleichzeitig das Signal 'kein Heimspeicher im System' fuer den Fallback ohne Batterie."
    entity_id = config.get("sensorMappings", {}).get("battery_state_of_charge", "")
    if not entity_id:
        return None
    try:
        state = homeassistant_adapter.load_entity_state(entity_id)
        if state.state in (None, "unknown", "unavailable", ""):
            return None
        value, _ = convert_to_expected_unit("battery_state_of_charge", state.state, state.unit)
        return float(value)
    except Exception:
        return None


def is_car_ready_to_charge(config):
    "True, wenn der aktuelle Wallbox-Verbindungsstatus als 'Auto kann laden' klassifiziert ist (siehe classify_wallbox_connection_state - dieselbe Zuordnung wie fuer die Anwesenheitsprognose)."
    entity_id = config.get("sensorMappings", {}).get("wallbox_plugged", "")
    if not entity_id:
        return False
    try:
        state = homeassistant_adapter.load_entity_state(entity_id)
        return classify_wallbox_connection_state(state.state, config) is True
    except Exception:
        return False


def _read_mapped_entity_state(config, sensor_key):
    "Shared Lookup: rohes EntityState (state/unit/last_updated) fuer einen sensorMappings-Eintrag - None, wenn nicht zugeordnet/unavailable/nicht lesbar. Basis fuer _read_mapped_numeric/_read_mapped_raw_state und (fuers Energiefluss-Widget) die *_ts-Varianten, die zusaetzlich den Zeitstempel brauchen."
    entity_id = config.get("sensorMappings", {}).get(sensor_key, "")
    if not entity_id:
        return None
    try:
        state = homeassistant_adapter.load_entity_state(entity_id)
        if state.state in (None, "unknown", "unavailable", ""):
            _note_sensor_health(sensor_key, entity_id, ok=False)
            return None
        _note_sensor_health(sensor_key, entity_id, ok=True)
        return state
    except Exception:
        _note_sensor_health(sensor_key, entity_id, ok=False)
        return None


def _read_mapped_numeric(config, sensor_key):
    "Generischer Live-Zahlenwert fuer einen beliebigen sensorMappings-Eintrag, konvertiert in die erwartete Einheit (siehe convert_to_expected_unit) - None, wenn nicht zugeordnet/unavailable/nicht lesbar. Fuer das Energiefluss-Widget (siehe compute_energy_flow_data), das viele verschiedene Sensoren auf dieselbe Art liest."
    state = _read_mapped_entity_state(config, sensor_key)
    if state is None:
        return None
    try:
        value, _ = convert_to_expected_unit(sensor_key, state.state, state.unit)
        return float(value)
    except Exception:
        return None


def _read_mapped_raw_state(config, sensor_key):
    "Wie _read_mapped_numeric, aber der rohe (unkonvertierte) Zustandswert als String - fuer Modus-/An-Aus-Sensoren ohne numerische Einheit."
    state = _read_mapped_entity_state(config, sensor_key)
    return state.state if state is not None else None


def _read_mapped_last_updated_iso(config, sensor_key):
    "ISO-Zeitstempel (last_updated), zu dem HA den zugeordneten Sensor zuletzt aktualisiert hat - None, wenn nicht zugeordnet/nicht lesbar/kein Zeitstempel geliefert. Fuers Energiefluss-Widget (Staleness-Anzeige, siehe compute_energy_flow_data)."
    state = _read_mapped_entity_state(config, sensor_key)
    if state is None or state.last_updated is None:
        return None
    return state.last_updated.isoformat()


def _read_mapped_bool_on(config, sensor_key):
    "Interpretiert einen zugeordneten binary_sensor/switch als An/Aus (HA's uebliche 'on'/'off'-Zustaende) - None, wenn nicht zugeordnet/nicht lesbar."
    raw = _read_mapped_raw_state(config, sensor_key)
    if raw is None:
        return None
    return raw.lower() == "on"


def detect_battery_flow_sign_convention():
    """Bestimmt empirisch, ob am rohen photovoltaic_powerflow_battery-Sensor ein negativer oder
    positiver Wert das Laden des Heimspeichers bedeutet - das ist (anders als beim Netz-Sensor)
    nicht herstellerunabhaengig standardisiert. Vergleicht dazu stundenweise den SOC-Verlauf
    (steigt/faellt) mit dem Rohwert in derselben Stunde, ueber BATTERY_SIGN_DETECTION_DAYS Tage
    Historie - per load_entity_history_raw + _forward_fill_hourly, denselben Bausteinen wie der
    Anwesenheits-Backfill (siehe backfill_car_presence_log). Gibt "raw_positive_is_charging",
    "raw_negative_is_charging" oder None (zu wenig/keine eindeutige Datenbasis) zurueck - schreibt
    NICHT selbst in die Config, das macht maybe_detect_battery_flow_sign_convention."""
    config = _read_current_config()
    flow_entity_id = config.get("sensorMappings", {}).get("photovoltaic_powerflow_battery", "")
    soc_entity_id = config.get("sensorMappings", {}).get("battery_state_of_charge", "")
    if not flow_entity_id or not soc_entity_id:
        return None

    now_hour = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    start = now_hour - timedelta(days=BATTERY_SIGN_DETECTION_DAYS)
    hours = [start + timedelta(hours=i) for i in range(int((now_hour - start).total_seconds() // 3600))]

    try:
        flow_events = homeassistant_adapter.load_entity_history_raw(flow_entity_id, start, now_hour)
        soc_events = homeassistant_adapter.load_entity_history_raw(soc_entity_id, start, now_hour)
    except Exception as e:
        print("[Shyft] Batterie-Vorzeichen-Erkennung: Historie konnte nicht geladen werden:", repr(e))
        return None

    flow_by_hour = _forward_fill_hourly(flow_events, hours)
    soc_by_hour = {}
    for hour_dt, soc_state in _forward_fill_hourly(soc_events, hours).items():
        try:
            soc_by_hour[hour_dt] = float(soc_state)
        except (TypeError, ValueError):
            pass

    positive_votes = 0  # "Rohwert positiv waehrend SOC steigt" (bzw. negativ waehrend SOC faellt)
    negative_votes = 0  # "Rohwert negativ waehrend SOC steigt" (bzw. positiv waehrend SOC faellt)
    for i in range(len(hours) - 1):
        hour_dt, next_hour = hours[i], hours[i + 1]
        if hour_dt not in flow_by_hour or hour_dt not in soc_by_hour or next_hour not in soc_by_hour:
            continue
        try:
            flow_value = float(flow_by_hour[hour_dt])
        except (TypeError, ValueError):
            continue
        soc_delta = soc_by_hour[next_hour] - soc_by_hour[hour_dt]
        if soc_delta == 0 or flow_value == 0:
            continue  # kein eindeutiges Signal in dieser Stunde
        if (soc_delta > 0) == (flow_value > 0):
            positive_votes += 1
        else:
            negative_votes += 1

    if positive_votes + negative_votes < BATTERY_SIGN_MIN_SAMPLES:
        return None
    return "raw_positive_is_charging" if positive_votes >= negative_votes else "raw_negative_is_charging"


def maybe_detect_battery_flow_sign_convention():
    "Versucht detect_battery_flow_sign_convention, aber nur wenn noch kein Ergebnis vorliegt und kein manueller Override gesetzt ist - re-triggerbar (Config-Save, Addon-Start, taeglicher Cron), bis genug Datenbasis vorhanden ist."
    config = _read_current_config()
    if config.get("batteryFlowSignOverride") is not None:
        return
    if config.get("batteryFlowSignConvention") is not None:
        return
    convention = detect_battery_flow_sign_convention()
    if convention is None:
        return
    config = _read_current_config()  # frisch lesen, falls sich die Config zwischenzeitlich geaendert hat
    config["batteryFlowSignConvention"] = convention
    _write_current_config(config)
    print(f"[Shyft] Batterie-Vorzeichen erkannt: {convention}")


def _normalized_battery_kw(config, raw_kw):
    "Wendet die erkannte/uebersteuerte Vorzeichen-Konvention an, damit compute_energy_flow_data immer 'positiv = laedt, negativ = entlaedt' liefert, unabhaengig vom rohen Sensor-Vorzeichen."
    if raw_kw is None:
        return None
    override = config.get("batteryFlowSignOverride")
    if override is True:
        return -raw_kw
    if override is False:
        return raw_kw
    convention = config.get("batteryFlowSignConvention")
    if convention == "raw_negative_is_charging":
        return -raw_kw
    return raw_kw  # Default/"raw_positive_is_charging": roh uebernehmen, solange nichts erkannt/uebersteuert wurde


PRICE_HIGH_THRESHOLD_CENT = 35
PRICE_LOW_THRESHOLD_CENT = 25


def _read_current_price_info():
    "Aktueller Strompreis (Cent/kWh) + Einstufung, aus dem stuendlich gecachten dashboard_cache.json (siehe sync_dashboard_chart_data) - dieselbe Quelle und dieselben Schwellen wie der Strompreis-Chart, kein zusaetzlicher shyft-Call. None, wenn noch kein Cache vorhanden oder die aktuelle Stunde darin nicht abgedeckt ist."
    try:
        with open(DASHBOARD_CACHE_PATH, "r") as f:
            cache = json.load(f)
    except Exception:
        return None
    input_csv = cache.get("input_csv")
    creation_date_ms = cache.get("creation_date")
    if not input_csv or creation_date_ms is None:
        return None
    start = datetime.fromtimestamp(creation_date_ms / 1000, tz=timezone.utc).replace(minute=0, second=0, microsecond=0)
    now_hour = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    index = int((now_hour - start).total_seconds() // 3600)
    try:
        rows = list(csv.DictReader(io.StringIO(input_csv), delimiter=";"))
    except Exception:
        return None
    if index < 0 or index >= len(rows):
        return None
    try:
        price_cent = round(float(rows[index].get("p_buy") or 0) * 100, 1)
    except (TypeError, ValueError):
        return None
    if price_cent > PRICE_HIGH_THRESHOLD_CENT:
        level = "hoch"
    elif price_cent < PRICE_LOW_THRESHOLD_CENT:
        level = "niedrig"
    else:
        level = "mittel"
    return {"cent": price_cent, "level": level}


# Sicherheitsmarge auf den guenstigsten noch bevorstehenden Strompreis - siehe compute_wb_p_min.
WB_P_MIN_MARGIN_EUR = 0.02


def compute_wb_p_min():
    """WB - p_min (EUR/kWh): der niedrigste ab jetzt (inklusive der aktuellen Stunde) noch
    bevorstehende Strompreis (p_buy, aus demselben gecachten input.csv wie
    _read_current_price_info) plus WB_P_MIN_MARGIN_EUR Sicherheitsmarge. Vergangene Stunden werden
    bewusst ausgeschlossen - der Optimierer soll die Wallbox nie unterhalb dessen laden lassen, was
    ohnehin der guenstigste noch kommende Preis waere. None, wenn noch kein Cache vorhanden oder
    keine bevorstehende Stunde darin abgedeckt ist."""
    try:
        with open(DASHBOARD_CACHE_PATH, "r") as f:
            cache = json.load(f)
    except Exception:
        return None
    input_csv = cache.get("input_csv")
    creation_date_ms = cache.get("creation_date")
    if not input_csv or creation_date_ms is None:
        return None
    start = datetime.fromtimestamp(creation_date_ms / 1000, tz=timezone.utc).replace(minute=0, second=0, microsecond=0)
    now_hour = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    current_index = int((now_hour - start).total_seconds() // 3600)
    try:
        rows = list(csv.DictReader(io.StringIO(input_csv), delimiter=";"))
    except Exception:
        return None
    upcoming_prices = []
    for i, row in enumerate(rows):
        if i < current_index:
            continue  # Stunden vor "jetzt" ausschliessen
        try:
            upcoming_prices.append(float(row.get("p_buy") or 0))
        except (TypeError, ValueError):
            continue
    if not upcoming_prices:
        return None
    return round(min(upcoming_prices) + WB_P_MIN_MARGIN_EUR, 4)


def compute_energy_flow_data():
    """Aggregiert alle Live-Werte fuers Energiefluss-Widget auf dem Dashboard (siehe
    buildEnergyFlowWidget im Frontend) in einem Response - jedes Geraet nur, wenn es ueberhaupt als
    Integration ausgewaehlt ist (integrationMappings), damit das Frontend nicht konfigurierte
    Geraete gar nicht erst zeichnet."""
    config = _read_current_config()
    integration_mappings = config.get("integrationMappings", {})

    def configured(section_key):
        return bool(integration_mappings.get(section_key))

    result = {}

    # last_updated-Zeitstempel je Rohsensor (ISO, oder None wenn nicht zugeordnet/nicht lesbar) -
    # das Frontend zeigt sie nur an, wenn der Wert aelter als ein Schwellwert ist (1min fuer die
    # Wechselrichter-Fluesse Grid/Household/Battery/PV, 10min fuer die uebrigen HA-Sensorwerte
    # z.B. Waermepumpe/Auto - siehe buildEnergyFlowLabel/formatKwWithTimestamp im Frontend). Werte,
    # die NICHT direkt aus HA kommen (z.B. der Strompreis aus _read_current_price_info, der aus dem
    # shyft-Cache stammt), bekommen bewusst keinen Zeitstempel.
    pv_configured = configured("wechselrichter")
    price_info = _read_current_price_info() if pv_configured else None
    result["grid"] = {
        "configured": pv_configured,
        "kw": _read_mapped_numeric(config, "photovoltaic_powerflow_grid") if pv_configured else None,
        "updatedAt": _read_mapped_last_updated_iso(config, "photovoltaic_powerflow_grid") if pv_configured else None,
        "priceCent": price_info["cent"] if price_info else None,
        "priceLevel": price_info["level"] if price_info else None,
    }
    result["pv"] = {
        "configured": pv_configured,
        "kw": _read_mapped_numeric(config, "photovoltaic_powerflow_pv") if pv_configured else None,
        "updatedAt": _read_mapped_last_updated_iso(config, "photovoltaic_powerflow_pv") if pv_configured else None,
    }
    load_kw = _read_mapped_numeric(config, "photovoltaic_powerflow_load") if pv_configured else None
    load_updated_at = _read_mapped_last_updated_iso(config, "photovoltaic_powerflow_load") if pv_configured else None
    wallbox_kw = _read_mapped_numeric(config, "wallbox_current_charging_power")
    heatpump_kw = _read_mapped_numeric(config, "heatpump_current_power_elect")
    heatpump_kw_updated_at = _read_mapped_last_updated_iso(config, "heatpump_current_power_elect")
    residual_kw = load_kw
    if load_kw is not None and (wallbox_kw is not None or heatpump_kw is not None):
        residual_kw = max(0.0, load_kw - (wallbox_kw or 0.0) - (heatpump_kw or 0.0))
    result["household"] = {
        "configured": pv_configured,
        "kw": load_kw,
        "residualKw": residual_kw,
        # Der Haushaltsstrom-Wert kommt direkt vom Haus-Verbrauchssensor (photovoltaic_powerflow_load)
        # - dessen Zeitstempel gilt, auch wenn residualKw rechnerisch noch Wallbox/Waermepumpe abzieht.
        "updatedAt": load_updated_at,
    }

    battery_configured = configured("batterie")
    result["battery"] = {
        "configured": battery_configured,
        "soc": _read_mapped_numeric(config, "battery_state_of_charge") if battery_configured else None,
        "mode": _read_mapped_raw_state(config, "battery_storage_command_mode") if battery_configured else None,
        "kw": _normalized_battery_kw(config, _read_mapped_numeric(config, "photovoltaic_powerflow_battery")) if battery_configured and pv_configured else None,
        "updatedAt": _read_mapped_last_updated_iso(config, "photovoltaic_powerflow_battery") if battery_configured and pv_configured else None,
    }

    heatpump_configured = configured("waermepumpe")
    result["heatpump"] = {
        "configured": heatpump_configured,
        "on": _read_mapped_bool_on(config, "heatpump_on_off") if heatpump_configured else None,
        "heatingOn": _read_mapped_bool_on(config, "heatpump_heating_activated") if heatpump_configured else None,
        "supplyTempC": _read_mapped_numeric(config, "heatpump_supply_temp_hp") if heatpump_configured else None,
        "dhwTankTempC": _read_mapped_numeric(config, "heatpump_dhw_tank_temp") if heatpump_configured else None,
        "targetTempC": _read_mapped_numeric(config, "heatpump_heating_target_temp_normal") if heatpump_configured else None,
        "kw": heatpump_kw if heatpump_configured else None,
        # Ein einzelner Zeitstempel fuer die ganze Waermepumpen-Kachel (statt je Einzelwert) reicht -
        # das Frontend zeigt hier ohnehin primaer den kW-Wert mit Zeitstempel an.
        "updatedAt": heatpump_kw_updated_at if heatpump_configured else None,
    }

    raumtemperatur_configured = configured("raumtemperatur")
    result["indoorTemp"] = {
        "configured": raumtemperatur_configured,
        "tempC": _read_mapped_numeric(config, "heatpump_temp_indoor_measured") if raumtemperatur_configured else None,
        "updatedAt": _read_mapped_last_updated_iso(config, "heatpump_temp_indoor_measured") if raumtemperatur_configured else None,
    }

    car_configured = configured("auto")
    wallbox_configured = configured("wallbox")
    car_state = None
    if wallbox_configured:
        connected = is_car_ready_to_charge(config)
        if not connected:
            car_state = "away"
        elif wallbox_kw and wallbox_kw > 0:
            car_state = "charging"
        else:
            car_state = "connected"
    battery_capacity_kwh = config.get("carBatteryCapacityKwh")
    consumption_kwh_per_100km = config.get("carConsumptionKwhPer100km")
    car_soc = _read_mapped_numeric(config, "electronicvehicle_state_of_charge") if car_configured else None
    car_soc_updated_at = _read_mapped_last_updated_iso(config, "electronicvehicle_state_of_charge") if car_configured else None
    range_km = None
    if car_soc is not None and battery_capacity_kwh and consumption_kwh_per_100km:
        try:
            range_km = round(battery_capacity_kwh * car_soc / consumption_kwh_per_100km)
        except (TypeError, ZeroDivisionError):
            range_km = None
    result["car"] = {
        "configured": car_configured,
        "soc": car_soc,
        "rangeKm": range_km,
        "wallboxConfigured": wallbox_configured,
        "state": car_state,
        "chargingKw": wallbox_kw if car_state == "charging" else None,
        # SOC- und Lade-kW-Zeitstempel koennen auseinanderlaufen (unterschiedliche Sensoren) - das
        # Frontend zeigt bei "lädt" den Lade-kW-Zeitstempel, sonst den SOC-Zeitstempel (siehe
        # buildCarFlowValue im Frontend).
        "updatedAt": car_soc_updated_at,
        "chargingKwUpdatedAt": _read_mapped_last_updated_iso(config, "wallbox_current_charging_power") if car_state == "charging" else None,
    }

    sonstiger_verbraucher_configured = configured("sonstiger_verbraucher")
    result["sonstigerVerbraucher"] = {
        "configured": sonstiger_verbraucher_configured,
        "on": _read_mapped_bool_on(config, "sonstiger_verbraucher_switch_entity") if sonstiger_verbraucher_configured else None,
        "updatedAt": _read_mapped_last_updated_iso(config, "sonstiger_verbraucher_switch_entity") if sonstiger_verbraucher_configured else None,
    }

    return result


@app.route("/dashboard/energy-flow", methods=["GET"])
def dashboardEnergyFlow():
    return jsonify(compute_energy_flow_data())


def _read_pv_surplus_actions():
    try:
        with open(PV_SURPLUS_ACTIONS_PATH, "r") as f:
            return json.load(f)
    except Exception:
        return []


def _write_pv_surplus_actions(actions):
    cutoff_ms = (datetime.now() - timedelta(days=PV_SURPLUS_ACTIONS_MAX_DAYS)).timestamp() * 1000
    pruned = [a for a in actions if a.get("active") or (a.get("end_ms") or 0) >= cutoff_ms]
    try:
        with open(PV_SURPLUS_ACTIONS_PATH, "w") as f:
            json.dump(pruned, f)
    except Exception as e:
        print("[Shyft] PV-Überschussladen: Aktionsliste konnte nicht gespeichert werden:", repr(e))


def _find_active_pv_surplus_session(actions):
    return next((a for a in actions if a.get("active")), None)


def _next_full_hour_ms(now_ms):
    "Millisekunden-Timestamp der naechsten vollen Stunde nach now_ms - die geplante Endzeit einer neu eroeffneten PV-Ueberschussladen-Session (siehe planned_end_ms)."
    now = datetime.fromtimestamp(now_ms / 1000, tz=timezone.utc)
    next_hour = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    return next_hour.timestamp() * 1000


def _append_pv_surplus_log(session, target_kw, note=None):
    "Vermerkt Ladeleistung und Uhrzeit im Log-Feld der Aktion, wie shyft-power es fuer seine eigenen Aktionen auch tut."
    timestamp = datetime.now().strftime("%d.%m. %H:%M Uhr")
    line = f"{timestamp}: {target_kw:.1f} kW"
    if note:
        line += f" ({note})"
    session.setdefault("log", []).append(line)
    session["log"] = session["log"][-100:]


def _pv_surplus_session_to_action(session):
    "Formt eine Fallback-Ladesession in dieselbe Form wie shyft-powers eigene Aktionen, damit sie in der Aktionsliste (Gerätesteuerung-Tab) nahtlos mit auftaucht (siehe readShyftActions)."
    target_kw = session.get("target_kw", 0)
    is_active = bool(session.get("active"))
    return {
        "Action Name": "Auto laden",
        "Status": "aktiv" if is_active else "beendet",
        "Execution Status": "yes, started",
        "Target Value": target_kw,
        "Subtitle": f"PV-Überschussladen (Fallback, {target_kw:.1f} kW)",
        "Date Start": session.get("start_ms"),
        "Date End": session.get("end_ms") if not is_active else session.get("planned_end_ms"),
        "Savings": None,
        "Log": "\n".join(session.get("log", [])),
    }


def stop_pv_surplus_charging(actions, session, config, reason=None):
    try:
        execute_car_charge_stop(session.get("target_kw"))
        _append_pv_surplus_log(session, session.get("target_kw", 0), note=reason or "beendet")
    except Exception as e:
        _append_pv_surplus_log(session, session.get("target_kw", 0), note=f"Stop fehlgeschlagen: {e}")
        print("[Shyft] PV-Überschussladen: Stop fehlgeschlagen:", repr(e))
    session["active"] = False
    session["end_ms"] = int(time.time() * 1000)
    _write_pv_surplus_actions(actions)
    notify_action_event(config, _pv_surplus_session_to_action(session), "beendet")


_pv_surplus_lock = threading.Lock()


def run_pv_surplus_charging_tick():
    """Serialisiert _run_pv_surplus_charging_tick_impl-Aufrufe - der Tick kann jetzt sowohl vom
    5-Minuten-Cron-Job als auch live vom Websocket-Handler bei einer Netz- oder
    Wallbox-Statusaenderung ausgeloest werden (siehe live_entity_watcher.py); ohne diese Sperre
    koennten zwei gleichzeitige Ticks dieselbe Sessions-Datei inkonsistent lesen/schreiben oder
    versehentlich zwei aktive Ladesessions gleichzeitig anlegen."""
    with _pv_surplus_lock:
        _run_pv_surplus_charging_tick_impl()


def _run_pv_surplus_charging_tick_impl():
    """Regelkreis fuer die PV-Überschussladen-Rückfalllogik, alle 5 Minuten aufgerufen (siehe
    Scheduler) sowie live bei relevanten Sensoraenderungen. Reagiert direkt auf den Netz-Sensor
    statt auf shyft-powers PV-Prognose, und läuft unabhängig davon, ob shyft-power selbst gerade
    eine "Auto laden"-Aktion laufen hat (siehe Kommentar oben) - die "Auto laden"-Logik wandert
    perspektivisch ohnehin vollständig ins Addon."""
    config = _read_current_config()
    actions = _read_pv_surplus_actions()
    session = _find_active_pv_surplus_session(actions)

    toggle_enabled = config.get("actionTypeEnabled", {}).get("car_charge_start", True)
    if not toggle_enabled:
        if session:
            stop_pv_surplus_charging(actions, session, config, reason="Auto laden deaktiviert")
        return

    # Jede Session ist auf die volle Stunde befristet (planned_end_ms, siehe Session-Eroeffnung
    # unten) - laeuft diese Frist ab, wird die Session explizit beendet statt implizit
    # weiterzulaufen. Der naechste Tick eroeffnet bei Bedarf eine GENUIN NEUE Session (siehe unten,
    # "else"-Zweig) - eine abgelaufene Session wird nie wieder aktiv genommen, sondern bleibt als
    # beendeter Eintrag stehen.
    now_ms = time.time() * 1000
    if session and session.get("planned_end_ms") is not None and now_ms >= session["planned_end_ms"]:
        stop_pv_surplus_charging(actions, session, config, reason="Stunde abgelaufen")
        return

    car_ready = is_car_ready_to_charge(config)
    battery_soc = read_home_battery_soc(config)
    has_battery = battery_soc is not None
    grid_kw = read_grid_power_kw(config)

    if session:
        if not car_ready:
            stop_pv_surplus_charging(actions, session, config, reason="Auto nicht mehr ladebereit")
            return
        if has_battery and battery_soc <= PV_SURPLUS_BATTERY_STOP_SOC:
            stop_pv_surplus_charging(actions, session, config, reason=f"Heimspeicher-SOC auf {battery_soc:.0f}% gefallen")
            return
        if grid_kw is None:
            return  # kein aktueller Messwert - Zielwert unveraendert bis zum naechsten Tick

        target_kw = session.get("target_kw", PV_SURPLUS_MIN_KW)
        if grid_kw <= PV_SURPLUS_REGULATION_THRESHOLD_KW:
            increase = abs(grid_kw) * PV_SURPLUS_INCREASE_OVERSHOOT
            if not has_battery:
                increase *= PV_SURPLUS_NO_BATTERY_INCREASE_SCALE
            new_target = target_kw + increase
        else:
            if not has_battery and target_kw <= PV_SURPLUS_MIN_KW + 1e-6:
                stop_pv_surplus_charging(actions, session, config, reason="keine Einspeisung mehr, Minimum erreicht")
                return
            if has_battery:
                new_target = target_kw * (1 - PV_SURPLUS_DECREASE_RATIO)
            else:
                decrease = max(target_kw * PV_SURPLUS_NO_BATTERY_DECREASE_RATIO, PV_SURPLUS_NO_BATTERY_MIN_DECREASE_KW)
                new_target = target_kw - decrease
        # obere Grenze aus den Wallbox-Eckdaten (siehe compute_wallbox_max_kw) - ohne dieses Cap
        # kann der additive Zweig oben (grid_kw <= Schwelle: "immer draufaddieren, solange
        # eingespeist wird") unbegrenzt weiter wachsen, weit ueber das hinaus, was die Wallbox
        # ueberhaupt zulaesst.
        new_target = max(PV_SURPLUS_MIN_KW, min(compute_wallbox_max_kw(config), new_target))

        session["has_battery"] = has_battery
        try:
            execute_car_charge_start(new_target)
        except Exception as e:
            # target_kw bewusst NICHT aktualisieren: ein fehlgeschlagener Call hat die Wallbox nicht
            # veraendert, der naechste Tick soll also wieder vom zuletzt tatsaechlich angewendeten
            # Wert aus rechnen statt auf dem verworfenen (und damit weiter aufaddieren, ohne dass
            # jemals wieder ein gueltiger Wert zustande kommt).
            _append_pv_surplus_log(session, new_target, note=f"Fehler: {e}")
            print("[Shyft] PV-Überschussladen: Update fehlgeschlagen:", repr(e))
            _write_pv_surplus_actions(actions)
            return
        _append_pv_surplus_log(session, new_target)
        session["target_kw"] = new_target
        _write_pv_surplus_actions(actions)
    else:
        if grid_kw is None or not car_ready:
            return
        start_threshold = PV_SURPLUS_START_THRESHOLD_KW if has_battery else PV_SURPLUS_START_THRESHOLD_NO_BATTERY_KW
        if grid_kw > start_threshold:
            return

        target_kw = max(PV_SURPLUS_MIN_KW, min(compute_wallbox_max_kw(config), abs(grid_kw)))
        try:
            execute_car_charge_start(target_kw)
        except Exception as e:
            print("[Shyft] PV-Überschussladen: Start fehlgeschlagen:", repr(e))
            return

        new_session = {"active": True, "target_kw": target_kw, "has_battery": has_battery,
                        "start_ms": int(now_ms), "planned_end_ms": _next_full_hour_ms(now_ms), "log": []}
        _append_pv_surplus_log(new_session, target_kw, note="gestartet")
        actions.append(new_session)
        _write_pv_surplus_actions(actions)
        notify_action_event(config, _pv_surplus_session_to_action(new_session), "gestartet")


def execute_hot_water_activate():
    """"Warmwasserbereitung" is a single fixed action (e.g. a Wärmepumpe-integration's "one-time
    DHW charge" service) rather than a multi-stage recipe like "Auto laden" - there's no computed
    value and no branch to pick, and (unlike a wallbox) nothing to explicitly turn back off again,
    so there's no matching stop/end action."""
    config = _read_current_config()
    recipe = config.get("hotWaterRecipe", {})
    if recipe.get("type") == "ha_automation":
        trigger_ha_automation(recipe.get("haAutomationEntityId"), "start", None)
        return
    call_recipe_stage(recipe, integration_key="waermepumpe")


def extract_select_options(field_info):
    """Reads the fixed choices out of a service field's selector, if it has a 'select' selector -
    the same schema Home Assistant's own Developer Tools -> Actions editor uses to render a
    dropdown instead of a free-text box. Options can be given as bare strings or {value, label}
    dicts; if the integration provides no inline label (translation_key-based selectors don't),
    we fall back to a humanized version of the value so there's still something readable to show.
    """
    options = ((field_info.get("selector") or {}).get("select") or {}).get("options") or []
    result = []
    for option in options:
        if isinstance(option, dict):
            value = option.get("value")
            label = option.get("label") or str(value).replace("_", " ").strip().capitalize()
        else:
            value = option
            label = str(option).replace("_", " ").strip().capitalize()
        result.append({"value": value, "label": label})
    return result


@app.route("/services", methods=["GET"])
def readServices():
    "Flat list of all Home Assistant services with their declared fields (incl. selector-based dropdown options where available) - used to build the 'Auto laden' Befehl-Auswahl (see buildCarChargeControl in app.js)"
    try:
        services_response = homeassistant_adapter.get_from_homeassistant("/api/services")
    except Exception as e:
        print("Failed to load services:", repr(e))
        return jsonify([])

    result = []
    for domain_entry in services_response:
        domain = domain_entry.get("domain")
        for service_name, service_info in (domain_entry.get("services") or {}).items():
            fields = []
            for field_name, field_info in (service_info.get("fields") or {}).items():
                # a "device" selector (or the common device_id naming, for integrations whose
                # schema doesn't declare one) means this field wants a device registry id - that
                # can be auto-filled from the already-selected Wallbox integration's own device(s)
                # instead of asking the user to type an id they have no way to look up themselves
                is_device_field = bool((field_info.get("selector") or {}).get("device")) or field_name == "device_id"
                # a "number" selector has no fixed choices to pick from. Its declared
                # unit_of_measurement (if any) is what lets the "Amperezahl setzen" stage tell
                # apart the field that actually means "current" from an unrelated one a service
                # might also have (e.g. Easee's set_charger_dynamic_limit also has a time_to_live,
                # in minutes, not amps) - see amountUnit/amountFields in app.js.
                number_selector = (field_info.get("selector") or {}).get("number") or {}
                is_number_field = bool(number_selector)
                fields.append({
                    "name": field_name,
                    "label": field_info.get("name") or field_name,
                    "options": extract_select_options(field_info),
                    "isDevice": is_device_field,
                    "isNumber": is_number_field,
                    "unit": number_selector.get("unit_of_measurement", ""),
                })

            # Generic Home Assistant services (e.g. number.set_value) declare their entity as a
            # "target" selector rather than a "field" - it never shows up in the loop above, so
            # without this a service like that would offer no way at all to pick which entity to
            # act on. Synthesize the same "entity_id" field custom integrations often declare
            # explicitly, unless the service already has one.
            if service_info.get("target", {}).get("entity") and not any(f["name"] == "entity_id" for f in fields):
                fields.insert(0, {
                    "name": "entity_id",
                    "label": "Entity",
                    "options": [],
                    "isDevice": False,
                    "isNumber": False,
                    "isEntity": True,
                })
            result.append({
                "service": f"{domain}.{service_name}",
                "label": service_info.get("name") or f"{domain}.{service_name}",
                "fields": fields,
            })
    result.sort(key=lambda s: s["service"])
    return jsonify(result)


@app.route("/actions/car_charge_start/test", methods=["POST"])
def testCarChargeStart():
    "Runs the exact same kW -> Phasen/Ampere pipeline as a real shyft-power action (see execute_car_charge_start), so this test is a faithful dry run rather than a simplified stand-in."
    config = _read_current_config()
    recipe = config.get("carChargeRecipe", {})
    recipe_type = recipe.get("type")
    if recipe_type not in ("three_stage", "ha_automation"):
        return jsonify({"success": False, "message": "Keine Variante ausgewählt"}), 400

    body = request.get_json(force=True, silent=True) or {}
    target_kw = body.get("targetKw")

    if recipe_type == "ha_automation":
        try:
            trigger_ha_automation_recipe(recipe, "start", target_kw)
            return jsonify({"success": True})
        except Exception as e:
            log_error_to_shyft("car_charge_start_test", classify_error(str(e)), str(e))
            return jsonify({"success": False, "message": str(e)}), 500

    try:
        if needs_stop_before_phase_change(target_kw):
            call_recipe_stage(recipe.get("control", {}), branch_key="stop")
            time.sleep(CHARGING_STAGE_DELAY_SECONDS)

        phase_count, amps = compute_charging_phases_and_amps(target_kw)
        call_recipe_stage(recipe.get("phaseCount", {}), branch_key=str(phase_count))
        time.sleep(CHARGING_STAGE_DELAY_SECONDS)

        amperage_stage = recipe.get("amperage", {})
        amount_fields = amperage_stage.get("amountFields") or []
        if not amount_fields:
            raise Exception("Kein Feld für die Amperezahl konfiguriert")
        call_recipe_stage(amperage_stage, extra_data={f: amps for f in amount_fields})
        time.sleep(CHARGING_STAGE_DELAY_SECONDS)

        call_recipe_stage(recipe.get("control", {}), branch_key="start")
        return jsonify({"success": True, "phaseCount": phase_count, "amps": amps})
    except RecipeCallError as e:
        log_error_to_shyft("car_charge_start_test", "service_call_failed", str(e), service_called=e.service, data_sent=e.data)
        return jsonify({"success": False, "message": str(e)}), 500
    except Exception as e:
        log_error_to_shyft("car_charge_start_test", classify_error(str(e)), str(e))
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/actions/car_charge_stop/test", methods=["POST"])
def testCarChargeStop():
    config = _read_current_config()
    recipe = config.get("carChargeRecipe", {})
    if recipe.get("type") == "ha_automation":
        try:
            trigger_ha_automation_recipe(recipe, "stop", None)
            return jsonify({"success": True})
        except Exception as e:
            log_error_to_shyft("car_charge_stop_test", classify_error(str(e)), str(e))
            return jsonify({"success": False, "message": str(e)}), 500
    try:
        call_recipe_stage(recipe.get("control", {}), branch_key="stop")
        return jsonify({"success": True})
    except RecipeCallError as e:
        log_error_to_shyft("car_charge_stop_test", "service_call_failed", str(e), service_called=e.service, data_sent=e.data)
        return jsonify({"success": False, "message": str(e)}), 500
    except Exception as e:
        log_error_to_shyft("car_charge_stop_test", classify_error(str(e)), str(e))
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/actions/hot_water_activate/test", methods=["POST"])
def testHotWaterActivate():
    config = _read_current_config()
    recipe = config.get("hotWaterRecipe", {})

    if recipe.get("type") == "ha_automation":
        if not recipe.get("haAutomationEntityId"):
            return jsonify({"success": False, "message": "Keine Automation ausgewählt"}), 400
        try:
            trigger_ha_automation(recipe.get("haAutomationEntityId"), "start", None)
            return jsonify({"success": True})
        except Exception as e:
            log_error_to_shyft("hot_water_activate_test", classify_error(str(e)), str(e),
                                service_called="automation.trigger")
            return jsonify({"success": False, "message": str(e)}), 500

    if not recipe.get("service"):
        return jsonify({"success": False, "message": "Kein Befehl konfiguriert"}), 400
    try:
        call_recipe_stage(recipe, integration_key="waermepumpe")
        return jsonify({"success": True})
    except RecipeCallError as e:
        log_error_to_shyft("hot_water_activate_test", "service_call_failed", str(e), service_called=e.service, data_sent=e.data)
        return jsonify({"success": False, "message": str(e)}), 500
    except Exception as e:
        log_error_to_shyft("hot_water_activate_test", classify_error(str(e)), str(e))
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/config", methods=["PUT"])
def writeConfig():
    content = request.get_data(as_text=True)
    incoming = json.loads(content)

    # iterate over key/value pairs. integrationMappings holds lists (multi-select), the rest hold plain strings.
    # entity ids never contain ":" or whitespace, so splitting on the first one strips both the old
    # "entity_id: state unit" and the current "entity_id (state unit)" display formats.
    for key, value in incoming.items():
        if not isinstance(value, dict):
            continue
        for inner_key, inner_value in value.items():
            if isinstance(inner_value, str):
                value[inner_key] = re.split(r"[:\s]", inner_value, maxsplit=1)[0]

    # merge onto the existing config instead of replacing it outright, so backend-managed
    # fields the frontend doesn't know about (startedShyftActionIds, endedShyftActionIds) survive
    data = _read_current_config()
    old_action_type_enabled = data.get("actionTypeEnabled", {})
    old_wallbox_mapping = data.get("wallboxConnectionStatusMapping", {})
    old_health_entity_ids = {
        key: data.get("sensorMappings", {}).get(key, "")
        for key in HEALTH_MONITORED_SENSOR_KEYS
    }
    old_battery_sensors = (
        data.get("sensorMappings", {}).get("battery_state_of_charge"),
        data.get("sensorMappings", {}).get("photovoltaic_powerflow_battery"),
    )
    data.update(incoming)

    script_sync_errors = {}
    for control_key, control in AUTO_MANAGED_CONTROLS.items():
        if control["type"] != "number":
            continue
        # automationOnly controls (see AUTOMATION_ONLY_CONTROL_KEYS) have no sensor_field/script to
        # sync - their actorMappings entry holds the user's HA-automation entity id instead, set
        # directly by the frontend, and must NOT be overwritten with the (empty) script_entity_id here.
        if control_key in AUTOMATION_ONLY_CONTROL_KEYS:
            continue
        entity_id = data.get("sensorMappings", {}).get(control["sensor_field"], "")
        try:
            script_entity_id = sync_number_script(control_key, entity_id)
            if "actorMappings" in data:
                data["actorMappings"][control["actor_key"]] = script_entity_id
        except Exception as e:
            print(f"Failed to sync {control_key} script:", repr(e))
            script_sync_errors[control_key] = str(e)

    if "actionTypeEnabled" in incoming:
        try:
            apply_action_type_toggle_changes(old_action_type_enabled, data.get("actionTypeEnabled", {}), data)
        except Exception as e:
            print("[Shyft] Sofort-Abgleich nach Toggle-Aenderung fehlgeschlagen:", repr(e))

    _write_current_config(data)

    # Ein neu zugeordneter/entfernter Sensor macht ein evtl. noch offenes "sensor_unavailable"-
    # Problem fuer die alte Entity gegenstandslos - aktiv freigeben, statt auf ein Timeout zu warten
    # (das es bewusst nicht gibt, siehe problem_registry).
    for key, old_entity_id in old_health_entity_ids.items():
        new_entity_id = data.get("sensorMappings", {}).get(key, "")
        if old_entity_id and old_entity_id != new_entity_id:
            problem_registry.clear(f"sensor_unavailable:{old_entity_id}")

    new_wallbox_mapping = data.get("wallboxConnectionStatusMapping", {})
    if new_wallbox_mapping and new_wallbox_mapping != old_wallbox_mapping:
        try:
            backfill_car_presence_log()
        except Exception as e:
            print("[Shyft] Anwesenheits-Backfill fehlgeschlagen:", repr(e))

    new_battery_sensors = (
        data.get("sensorMappings", {}).get("battery_state_of_charge"),
        data.get("sensorMappings", {}).get("photovoltaic_powerflow_battery"),
    )
    if new_battery_sensors != old_battery_sensors:
        # die Zuordnung hat sich geaendert - eine evtl. bereits erkannte Konvention galt fuer den
        # alten Sensor und ist jetzt nicht mehr belastbar, ausser bei einem manuellen Override
        data["batteryFlowSignConvention"] = None
        _write_current_config(data)
    if all(new_battery_sensors):
        try:
            maybe_detect_battery_flow_sign_convention()
        except Exception as e:
            print("[Shyft] Batterie-Vorzeichen-Erkennung fehlgeschlagen:", repr(e))

    response_data = dict(data)
    response_data["scriptSyncErrors"] = script_sync_errors
    return jsonify(response_data)


@app.route("/actions/<control_key>/status", methods=["GET"])
def statusAutoManagedControl(control_key):
    control = AUTO_MANAGED_CONTROLS.get(control_key)
    if not control:
        return jsonify({"error": "unbekannte Steuerung"}), 404

    config = _read_current_config()
    variant = resolve_control_variant(control_key, config)

    if variant == "ha_automation":
        # No sensor/entity to poll a value from - the addon only ever fires the user's
        # own automation, so "configured" just checks the automation field(s) are set.
        actor_mappings = config.get("actorMappings", {})
        if control["type"] == "number":
            configured = bool(actor_mappings.get(control_key))
        else:  # switch
            configured = bool(actor_mappings.get("consumer_on")) and bool(actor_mappings.get("consumer_off"))
        return jsonify({"configured": configured})

    entity_id = config.get("sensorMappings", {}).get(control["sensor_field"], "")
    if not entity_id:
        return jsonify({"configured": False})

    if control["type"] == "number":
        script_entity_id = f"script.{control['script_id']}"
        script_state = homeassistant_adapter.get_from_homeassistant(f"/api/states/{script_entity_id}")
        if not isinstance(script_state, dict) or "state" not in script_state:
            return jsonify({
                "configured": True,
                "entity_id": entity_id,
                "value": None,
                "error": f"{script_entity_id} wurde noch nicht angelegt. Speichere die Entity erneut oder prüfe die Addon-Logs."
            })
        try:
            value = homeassistant_adapter.read_entity_numeric_value(entity_id)
            return jsonify({"configured": True, "entity_id": entity_id, "value": value})
        except Exception as e:
            return jsonify({"configured": True, "entity_id": entity_id, "value": None, "error": str(e)})
    else:  # switch
        try:
            state = homeassistant_adapter.get_from_homeassistant(f"/api/states/{entity_id}")
            if not isinstance(state, dict) or "state" not in state:
                raise Exception(f"{entity_id} liefert keinen Status")
            return jsonify({"configured": True, "entity_id": entity_id, "value": state["state"]})
        except Exception as e:
            return jsonify({"configured": True, "entity_id": entity_id, "value": None, "error": str(e)})


@app.route("/actions/<control_key>/test", methods=["POST"])
def testAutoManagedControl(control_key):
    control = AUTO_MANAGED_CONTROLS.get(control_key)
    if not control:
        return jsonify({"success": False, "message": "unbekannte Steuerung"}), 404

    config = _read_current_config()
    variant = resolve_control_variant(control_key, config)
    body = request.get_json(force=True, silent=True) or {}

    if variant == "ha_automation":
        actor_mappings = config.get("actorMappings", {})
        if control["type"] == "number":
            delta = body.get("delta", 0)
            automation_entity_id = actor_mappings.get(control_key)
            try:
                trigger_ha_automation(automation_entity_id, "start", delta)
                return jsonify({"success": True, "value": delta, "confirmed": False})
            except Exception as e:
                log_error_to_shyft(f"{control_key}_test", classify_error(str(e)), str(e),
                                    service_called="automation.trigger", data_sent={"target": delta})
                return jsonify({"success": False, "message": str(e)}), 500
        else:  # switch - single button, alternates start/stop each click (frontend tracks phase)
            phase = body.get("phase", "start")
            automation_entity_id = actor_mappings.get("consumer_on" if phase == "start" else "consumer_off")
            try:
                trigger_ha_automation(automation_entity_id, phase, None)
                return jsonify({"success": True, "value": phase, "confirmed": False})
            except Exception as e:
                log_error_to_shyft(f"{control_key}_test", classify_error(str(e)), str(e),
                                    service_called="automation.trigger", data_sent={"phase": phase})
                return jsonify({"success": False, "message": str(e)}), 500

    entity_id = config.get("sensorMappings", {}).get(control["sensor_field"], "")
    if not entity_id:
        return jsonify({"success": False, "message": "Keine Entity zugeordnet"}), 400

    if control["type"] == "number":
        delta = body.get("delta", 0)
        try:
            current_value = homeassistant_adapter.read_entity_numeric_value(entity_id)
            new_value = current_value + delta
            homeassistant_adapter.call_service("script", control["script_id"], {"target_value": new_value})
            # Cloud-connected devices (e.g. a heat pump reachable only via the manufacturer's
            # cloud API) can take much longer than a second or two to actually report the new
            # value back, so we return the optimistic value immediately instead of blocking
            # here and risking showing the stale one. The frontend re-checks shortly after.
            return jsonify({"success": True, "value": new_value, "confirmed": False})
        except Exception as e:
            log_error_to_shyft(f"{control_key}_test", classify_error(str(e)), str(e),
                                service_called=f"script.{control['script_id']}", data_sent={"target_value": delta})
            return jsonify({"success": False, "message": str(e)}), 500
    else:  # switch - single button, alternates start/stop each click (frontend tracks phase)
        phase = body.get("phase", "start")
        turn_on = phase == "start"
        try:
            homeassistant_adapter.call_service("homeassistant", "turn_on" if turn_on else "turn_off", {"entity_id": entity_id})
            return jsonify({"success": True, "value": "on" if turn_on else "off", "confirmed": False})
        except Exception as e:
            log_error_to_shyft(f"{control_key}_test", classify_error(str(e)), str(e),
                                service_called="homeassistant.turn_on" if turn_on else "homeassistant.turn_off",
                                data_sent={"entity_id": entity_id})
            return jsonify({"success": False, "message": str(e)}), 500


def _read_current_config():
    with open(CONFIG_PATH, "r") as file:
        return json.load(file)


def _write_current_config(data):
    with open(CONFIG_PATH, "w") as file:
        file.write(json.dumps(data))


# Which actorMappings keys represent a distinct Aktionstyp shyft-power schedules, and the exact
# "Action Name" string shyft-power uses for it in the action queue (confirmed identical/stable).
# Keys left out on purpose: battery_action_stop and car_charge_stop are shared "stop" actors for
# an already-toggled type (battery_grid_charge/battery_discharge_shift, car_charge_start) and
# don't need their own toggle; consumer_off is the same kind of paired stop actor for consumer_on.
ACTION_TYPE_TOGGLE_KEYS = {
    "pv_feed_in_limit": "PV: Einspeisung begrenzen",
    "consumption_limit_14a": "Verbrauch begrenzen (§14a)",
    "battery_charge_shift_pv_surplus": "Batterie-Laden verschieben (PV-Überschuss)",
    "battery_discharge_shift": "Batterie-Entladen verschieben",
    "battery_grid_charge": "Batterie netzladen",
    "hot_water": "Warmwasser",
    "heating_target_temp": "Heizung Soll-Temperatur",
    "car_charge_start": "Auto laden",
    "consumer_on": "Verbraucher an",
}
ACTION_NAME_TO_ACTOR_KEY = {name: key for key, name in ACTION_TYPE_TOGGLE_KEYS.items()}

# These three battery Aktionstypen have no direct-entity-control alternative (see
# AUTO_MANAGED_CONTROLS) - they're always "trigger the user's own automation", using whatever's
# mapped under their own actorMappings key (see actorHelpInformation in app.js). All three share
# the same stop automation (actorMappings["battery_action_stop"]) rather than each having their own.
BATTERY_SHIFT_ACTOR_KEYS = {"battery_charge_shift_pv_surplus", "battery_discharge_shift", "battery_grid_charge"}

# Notification types the user can toggle in the "Benachrichtigungen" config section - extend this
# dict as new types are added, the frontend renders one toggle row per entry.
NOTIFICATION_TYPES = {
    "action_start_end": "Aktionen starten / beenden",
    "device_status_deviation": "Geräteverhalten abweichend von Shyft-Steuerung",
}

# Aktionstypen the addon controls directly (writes the mapped entity itself), no user-side
# automation needed - mirrors AUTO_MANAGED_CONTROLS in www/app.js. "number" controls go through
# an auto-managed script (like a Home Assistant blueprint, but generated and kept in sync by the
# addon); "switch" controls are turned on/off directly, no script involved.
AUTO_MANAGED_CONTROLS = {
    "heating_target_temp": {
        "type": "number",
        "sensor_field": "heatpump_heating_target_temp_normal",
        "actor_key": "heating_target_temp",
        "script_id": HEATING_TARGET_TEMP_SCRIPT_ID,
        "script_alias": "Shyft: Heizung Soll-Temperatur",
        "field_label": "Zieltemperatur",
        "field_description": "Die von Shyft berechnete Soll-Temperatur in °C.",
        "min": 0, "max": 100, "step": 0.5,
    },
    "pv_feed_in_limit": {
        "type": "number",
        "sensor_field": "photovoltaic_feed_in_limit_entity",
        "actor_key": "pv_feed_in_limit",
        "script_id": "shyft_pv_feed_in_limit",
        "script_alias": "Shyft: PV-Einspeisung begrenzen",
        "field_label": "Einspeiselimit",
        "field_description": "Das von Shyft berechnete Einspeiselimit.",
        "min": 0, "max": 100000, "step": 1,
    },
    "consumption_limit_14a": {
        "type": "number",
        "sensor_field": "photovoltaic_consumption_limit_entity",
        "actor_key": "consumption_limit_14a",
        "script_id": "shyft_consumption_limit_14a",
        "script_alias": "Shyft: Verbrauch begrenzen (§14a)",
        "field_label": "Verbrauchslimit",
        "field_description": "Das von Shyft berechnete Verbrauchslimit gemäß §14a EnWG.",
        "min": 0, "max": 100000, "step": 1,
    },
    "consumer_on_off": {
        "type": "switch",
        "sensor_field": "sonstiger_verbraucher_switch_entity",
        "actor_keys": ["consumer_on", "consumer_off"],
    },
}

# These two have no direct-entity-control alternative (mirrors automationOnly in
# AUTO_MANAGED_CONTROLS in www/app.js, which also removed their sensorField/config UI) - always
# resolves to "ha_automation" below regardless of what's stored under controlVariant, so a stale
# "direct" value from before this change (or simply never having been set) can't make
# execute_auto_managed_action try to use the now-nonexistent sensor_field entity.
AUTOMATION_ONLY_CONTROL_KEYS = {"pv_feed_in_limit", "consumption_limit_14a"}


def resolve_control_variant(control_key, config):
    "Single place that decides 'direct' vs 'ha_automation' for an AUTO_MANAGED_CONTROLS entry - see AUTOMATION_ONLY_CONTROL_KEYS."
    if control_key in AUTOMATION_ONLY_CONTROL_KEYS:
        return "ha_automation"
    return config.get("controlVariant", {}).get(control_key, "direct")

# Reverse lookup from shyft-power's "Action Name" to the auto-managed control that handles it,
# derived from ACTION_TYPE_TOGGLE_KEYS so the Action Name string lives in exactly one place.
# consumer_off is intentionally absent from ACTION_TYPE_TOGGLE_KEYS (see there), so it's covered
# implicitly: "Verbraucher an" is the single Action Name shyft-power uses for the whole lifecycle
# of that Aktionstyp, start and end alike (see process_shyft_actions).
def _build_action_name_to_control_key():
    result = {}
    for control_key, control in AUTO_MANAGED_CONTROLS.items():
        for actor_key in control.get("actor_keys") or [control.get("actor_key")]:
            action_name = ACTION_TYPE_TOGGLE_KEYS.get(actor_key)
            if action_name:
                result[action_name] = control_key
    return result


ACTION_NAME_TO_CONTROL_KEY = _build_action_name_to_control_key()


def is_action_type_enabled(config, action_name):
    "Addon-side replacement for shyft-power's own '(deaktiviert)' status suffix - the per-Aktionstyp toggle decides, not shyft-power."
    actor_key = ACTION_NAME_TO_ACTOR_KEY.get(action_name)
    if actor_key is None:
        return True
    return config.get("actionTypeEnabled", {}).get(actor_key, True)


def notify_action_event(config, action, verb):
    "Sends an optional push notification (e.g. 'gestartet'/'beendet') if the user configured a phone target and hasn't disabled this notification type."
    if not config.get("notificationsEnabled", {}).get("action_start_end", True):
        return
    target = config.get("notificationTargets", {}).get("phone", "")
    if not target:
        return
    label = action.get("Action Name", "?")
    try:
        homeassistant_adapter.send_notification(target, f"Shyft-Aktion {verb}: {label}")
    except Exception as e:
        print(f"[Shyft] Benachrichtigung fehlgeschlagen: {e!r}")


def check_device_status_deviation(action, config):
    """Placeholder - comparing the actual Home Assistant device state against what shyft-power
    currently commands for a running action requires the same per-action logic as the concrete
    start/end behaviour (see handle_shyft_action_start/end), which is defined in a later step.
    Wired into the 15-min poll now so the notification only needs enabling once that lands.
    """
    if not config.get("notificationsEnabled", {}).get("device_status_deviation", True):
        return
    # no per-action comparison logic yet - nothing to detect or notify about


def _action_problem_id(label):
    "Stabile Problem-Registry-ID aus einem Action-Name, z.B. 'Auto laden' -> 'action_failed:auto_laden'."
    slug = re.sub(r"[^a-z0-9]+", "_", (label or "unbekannt").lower()).strip("_") or "unbekannt"
    return f"action_failed:{slug}"


def _note_action_outcome(label, phase, error=None):
    "Meldet bzw. loescht in der Problem-Registry ein 'action_failed:<label>'-Problem: error=None gibt es frei, sonst wird die Geraete-Fehlermeldung als Klartext-Problem hinterlegt. phase ist 'gestartet' oder 'beendet'."
    problem_id = _action_problem_id(label)
    if error is None:
        problem_registry.clear(problem_id)
    else:
        problem_registry.register(
            problem_id,
            f"Die Aktion \"{label}\" konnte nicht {phase} werden: {error}. shyft-power hat die "
            f"Aktion angefordert, aber vom Geraet kam eine Fehlermeldung.",
        )


def handle_shyft_action_start(action, actions_enabled, config):
    "For direct-entity-control Aktionstypen (see AUTO_MANAGED_CONTROLS) this really executes; everything else is still a placeholder pending a later step."
    label = action.get("Action Name", "?")
    target = action.get("Target Value")
    control_key = ACTION_NAME_TO_CONTROL_KEY.get(label)

    if not actions_enabled:
        print(f"[Shyft] Start faellig fuer '{label}' (Ziel: {target}) - Aktionstyp ist deaktiviert, nur simuliert.")
        _note_action_outcome(label, "gestartet")  # deaktiviert = kein Ausfuehrungsfehler, evtl. alten Eintrag freigeben
    elif label == "Auto laden":
        try:
            execute_car_charge_start(target)
            print(f"[Shyft] Start ausgefuehrt fuer '{label}' (Ziel: {target} kW).")
            _note_action_outcome(label, "gestartet")
        except Exception as e:
            print(f"[Shyft] Start fuer '{label}' fehlgeschlagen: {e!r}")
            _note_action_outcome(label, "gestartet", e)
    elif label == "Warmwasser":
        try:
            execute_hot_water_activate()
            print(f"[Shyft] Start ausgefuehrt fuer '{label}'.")
            _note_action_outcome(label, "gestartet")
        except Exception as e:
            print(f"[Shyft] Start fuer '{label}' fehlgeschlagen: {e!r}")
            _note_action_outcome(label, "gestartet", e)
    elif ACTION_NAME_TO_ACTOR_KEY.get(label) in BATTERY_SHIFT_ACTOR_KEYS:
        try:
            automation_entity_id = config.get("actorMappings", {}).get(ACTION_NAME_TO_ACTOR_KEY[label])
            trigger_ha_automation(automation_entity_id, "start", target)
            print(f"[Shyft] Start ausgefuehrt fuer '{label}' (Ziel: {target}).")
            _note_action_outcome(label, "gestartet")
        except Exception as e:
            print(f"[Shyft] Start fuer '{label}' fehlgeschlagen: {e!r}")
            _note_action_outcome(label, "gestartet", e)
    elif control_key:
        try:
            execute_auto_managed_action(control_key, "start", target)
            print(f"[Shyft] Start ausgefuehrt fuer '{label}' (Ziel: {target}).")
            _note_action_outcome(label, "gestartet")
        except Exception as e:
            print(f"[Shyft] Start fuer '{label}' fehlgeschlagen: {e!r}")
            _note_action_outcome(label, "gestartet", e)
    else:
        print(f"[Shyft] Start faellig fuer '{label}' (Ziel: {target}) - Ausfuehrung pro Aktion noch nicht implementiert.")

    notify_action_event(config, action, "gestartet" if actions_enabled else "gestartet (nur simuliert)")


def handle_shyft_action_end(action, actions_enabled, config):
    "For direct-entity-control Aktionstypen (see AUTO_MANAGED_CONTROLS) this really executes; everything else is still a placeholder pending a later step."
    label = action.get("Action Name", "?")
    # only the "ha_automation" car-charge variant makes use of this - the addon-driven 3-stage
    # stop doesn't need a target, but the user's own automation might want to know it
    target = action.get("Target Value")
    control_key = ACTION_NAME_TO_CONTROL_KEY.get(label)

    if not actions_enabled:
        print(f"[Shyft] Ende faellig fuer '{label}' - Aktionstyp ist deaktiviert, nur simuliert.")
        _note_action_outcome(label, "beendet")  # deaktiviert = kein Ausfuehrungsfehler, evtl. alten Eintrag freigeben
    elif label == "Auto laden":
        try:
            execute_car_charge_stop(target)
            print(f"[Shyft] Ende ausgefuehrt fuer '{label}'.")
            _note_action_outcome(label, "beendet")
        except Exception as e:
            print(f"[Shyft] Ende fuer '{label}' fehlgeschlagen: {e!r}")
            _note_action_outcome(label, "beendet", e)
    elif label == "Warmwasser":
        _note_action_outcome(label, "beendet")  # single-action Aktionstyp, kein Ende-Verhalten (siehe execute_hot_water_activate)
    elif ACTION_NAME_TO_ACTOR_KEY.get(label) in BATTERY_SHIFT_ACTOR_KEYS:
        try:
            # shared across all three battery Aktionstypen - see BATTERY_SHIFT_ACTOR_KEYS - and no
            # target value, unlike the start: "stop the current battery action" has nothing to aim for
            automation_entity_id = config.get("actorMappings", {}).get("battery_action_stop")
            trigger_ha_automation(automation_entity_id, "stop", None)
            print(f"[Shyft] Ende ausgefuehrt fuer '{label}'.")
            _note_action_outcome(label, "beendet")
        except Exception as e:
            print(f"[Shyft] Ende fuer '{label}' fehlgeschlagen: {e!r}")
            _note_action_outcome(label, "beendet", e)
    elif control_key:
        try:
            execute_auto_managed_action(control_key, "end", None)
            print(f"[Shyft] Ende ausgefuehrt fuer '{label}'.")
            _note_action_outcome(label, "beendet")
        except Exception as e:
            print(f"[Shyft] Ende fuer '{label}' fehlgeschlagen: {e!r}")
            _note_action_outcome(label, "beendet", e)
    else:
        print(f"[Shyft] Ende faellig fuer '{label}' - Ausfuehrung pro Aktion noch nicht implementiert.")

    notify_action_event(config, action, "beendet" if actions_enabled else "beendet (nur simuliert)")


def process_shyft_actions():
    """Polls shyft-power's action queue and fires start/end hooks based on timing, independent
    of what the API currently reports for status (see handle_shyft_action_start/end).

    Start: Status is "aktiv" and Date Start has passed - fired exactly once per action id,
    tracked via a persisted set of already-started ids. This also covers extended actions for
    free: an extension keeps the same id and only pushes Date End further out, so it's already
    in the set and won't fire again. A superseded ("abgeloest") action gets a new id from Shyft,
    which correctly fires its own start.

    End: Date End has passed, regardless of Status - fired exactly once per action id, tracked
    via a persisted set of already-ended ids so it survives addon restarts and doesn't require
    re-checking the API.

    Whether a fire is "real" or "simulated only" is decided per Aktionstyp via the addon's own
    actionTypeEnabled toggle (see is_action_type_enabled) - shyft-power's own '(deaktiviert)'
    status suffix is intentionally ignored here.
    """
    config = _read_current_config()
    started_ids = set(config.get("startedShyftActionIds", []))
    ended_ids = set(config.get("endedShyftActionIds", []))

    user_id = extract_shyft_user_id(shyft_adapter.bubble_token)
    if not user_id:
        print("[Shyft] Kein gueltiger Access-Key konfiguriert, ueberspringe Action-Poll.")
        return

    result = shyft_adapter.get_actions(user_id)
    if result.get("status") != "success":
        print("[Shyft] Action-Poll fehlgeschlagen:", result.get("message"))
        return

    actions = (result.get("response") or {}).get("actions") or []
    now_ms = time.time() * 1000
    seen_ids = set()

    for action in actions:
        action_id = action.get("_id")
        if action_id:
            seen_ids.add(action_id)

        status = (action.get("Status") or "").lower()
        is_active = status.startswith("aktiv")
        date_start = action.get("Date Start")
        date_end = action.get("Date End")
        enabled = is_action_type_enabled(config, action.get("Action Name"))

        if is_active and date_start is not None and date_start <= now_ms and action_id and action_id not in started_ids:
            handle_shyft_action_start(action, enabled, config)
            started_ids.add(action_id)

        if date_end is not None and date_end <= now_ms and action_id and action_id not in ended_ids:
            handle_shyft_action_end(action, enabled, config)
            ended_ids.add(action_id)

        currently_running = is_active and date_start is not None and date_start <= now_ms and not (date_end is not None and date_end <= now_ms)
        if currently_running:
            check_device_status_deviation(action, config)

    # only keep ids that could still turn up in a future poll, so these don't grow forever
    config["startedShyftActionIds"] = sorted(started_ids & seen_ids)
    config["endedShyftActionIds"] = sorted(ended_ids & seen_ids)
    _write_current_config(config)


def apply_action_type_toggle_changes(old_map, new_map, config):
    """Called from writeConfig when the actionTypeEnabled toggles changed. A currently running
    action of an affected Aktionstyp must be stopped/started right away instead of waiting for
    the next scheduled poll (up to 15 min later).
    """
    changed_keys = [k for k in new_map if new_map.get(k, True) != old_map.get(k, True)]
    if not changed_keys:
        return

    changed_names = {ACTION_TYPE_TOGGLE_KEYS[k] for k in changed_keys if k in ACTION_TYPE_TOGGLE_KEYS}
    if not changed_names:
        return

    user_id = extract_shyft_user_id(shyft_adapter.bubble_token)
    if not user_id:
        return

    result = shyft_adapter.get_actions(user_id)
    if result.get("status") != "success":
        print("[Shyft] Sofort-Abgleich nach Toggle-Aenderung fehlgeschlagen:", result.get("message"))
        return

    actions = (result.get("response") or {}).get("actions") or []
    now_ms = time.time() * 1000
    started_ids = set(config.get("startedShyftActionIds", []))
    ended_ids = set(config.get("endedShyftActionIds", []))

    for action in actions:
        action_name = action.get("Action Name")
        if action_name not in changed_names:
            continue

        action_id = action.get("_id")
        status = (action.get("Status") or "").lower()
        is_active = status.startswith("aktiv")
        date_start = action.get("Date Start")
        date_end = action.get("Date End")

        # only a currently running action needs immediate action - anything else is handled by
        # the normal poll (a future action just picks up the new toggle state when it starts)
        if not (is_active and date_start is not None and date_start <= now_ms):
            continue
        if date_end is not None and date_end <= now_ms:
            continue

        # actions_enabled=True in both branches: this whole block only runs for a type whose
        # toggle just changed, so the newly-on type must really start and the newly-off type
        # must really stop - neither call is "simulate only"
        now_enabled = is_action_type_enabled(config, action_name)
        if now_enabled and action_id and action_id not in started_ids:
            handle_shyft_action_start(action, True, config)
            started_ids.add(action_id)
        elif not now_enabled and action_id and action_id not in ended_ids:
            handle_shyft_action_end(action, True, config)
            ended_ids.add(action_id)

    config["startedShyftActionIds"] = sorted(started_ids)
    config["endedShyftActionIds"] = sorted(ended_ids)


def _read_pv_forecast_snapshot():
    try:
        with open(PV_FORECAST_SNAPSHOT_PATH, "r") as f:
            return json.load(f)
    except Exception:
        return None


def _maybe_freeze_pv_forecast_snapshot(input_csv, creation_date_ms):
    """Schreibt PV_FORECAST_SNAPSHOT_PATH nur, wenn dort noch keine Prognose fuer den heutigen
    (lokalen) Kalendertag liegt - danach bleibt der Snapshot fuer den Rest des Tages unangetastet,
    auch wenn sync_dashboard_chart_data() stuendlich weiter neue Prognosen holt. Nimmt aus dem
    JUST gefetchten input_csv nur die Zeilen, die tatsaechlich auf "heute" fallen - deckt die
    Prognose den bisherigen Tagesverlauf (noch) nicht ab (z.B. weil creation_date schon nach 0 Uhr
    liegt), bleiben diese fruehen Stunden im Snapshot einfach leer statt geraten.

    Nutzt die Systemzeitzone des Containers fuer den Tagesbezug (bei einer normalen Home-Assistant-
    OS/Supervised-Installation identisch zur in HA konfigurierten Zeitzone)."""
    today_local = date.today().isoformat()
    existing = _read_pv_forecast_snapshot()
    if existing and existing.get("date") == today_local:
        return

    start_utc = datetime.fromtimestamp(creation_date_ms / 1000, tz=timezone.utc).replace(minute=0, second=0, microsecond=0)
    try:
        rows = list(csv.DictReader(io.StringIO(input_csv), delimiter=";"))
    except Exception as e:
        print("[Shyft] PV-Prognose-Snapshot: input_csv konnte nicht gelesen werden:", repr(e))
        return

    labels, pv_generation = [], []
    for i, row in enumerate(rows):
        row_dt_utc = start_utc + timedelta(hours=i)
        if row_dt_utc.astimezone().date().isoformat() != today_local:
            continue
        labels.append(row_dt_utc.isoformat())
        pv_generation.append(float(row.get("PV_generation") or 0))
    if not labels:
        return  # Prognose deckt "heute" (noch) gar nicht ab - naechster Sync versucht es erneut

    try:
        with open(PV_FORECAST_SNAPSHOT_PATH, "w") as f:
            json.dump({"date": today_local, "labels": labels, "pv_generation": pv_generation}, f)
    except Exception as e:
        print("[Shyft] PV-Prognose-Snapshot konnte nicht gespeichert werden:", repr(e))


def sync_dashboard_chart_data():
    "Refreshes the cached optimizer input_csv/output_csv/creation_date (see DASHBOARD_CACHE_PATH) from shyft-power - runs hourly (see scheduler), alongside the action queue poll, since the underlying data itself only changes about that often."
    user_id = extract_shyft_user_id(shyft_adapter.bubble_token)
    if not user_id:
        return
    result = shyft_adapter.get_input_output_csv(user_id)
    response_data = (result or {}).get("response") or {}
    input_csv = response_data.get("input_csv")
    output_csv = response_data.get("output_csv")
    creation_date_ms = response_data.get("creation_date")
    if not input_csv or creation_date_ms is None:
        print("[Shyft] Dashboard-Chart-Daten: input_csv oder creation_date fehlt in der Antwort von shyft-power.")
        return
    try:
        with open(DASHBOARD_CACHE_PATH, "w") as f:
            json.dump({"input_csv": input_csv, "output_csv": output_csv, "creation_date": creation_date_ms}, f)
    except Exception as e:
        print("[Shyft] Dashboard-Chart-Daten konnten nicht zwischengespeichert werden:", repr(e))
    _maybe_freeze_pv_forecast_snapshot(input_csv, creation_date_ms)


def sync_sensors_periodically():
    with app.app_context():
        sync_site_data()

def sync_pv_history_periodically():
    with app.app_context():
        sync_pv_history()

def process_shyft_actions_periodically():
    with app.app_context():
        process_shyft_actions()

def sync_dashboard_chart_data_periodically():
    with app.app_context():
        sync_dashboard_chart_data()

def sync_car_presence_log_periodically():
    with app.app_context():
        sync_car_presence_log()

def run_pv_surplus_charging_tick_periodically():
    with app.app_context():
        run_pv_surplus_charging_tick()

def maybe_detect_battery_flow_sign_convention_periodically():
    with app.app_context():
        maybe_detect_battery_flow_sign_convention()


# Live-Reaktion via Websocket (siehe live_entity_watcher.py) - ergaenzt, ersetzt aber nicht die
# obigen Cron-Jobs (sync_car_presence_log_periodically, run_pv_surplus_charging_tick_periodically),
# die als Sicherheitsnetz weiterlaufen, falls die Websocket-Verbindung mal laenger steht.
PV_SURPLUS_LIVE_UPDATE_THRESHOLD_KW = 0.1
_last_live_grid_kw = {"value": None}


def _on_grid_power_live_update(entity_id, old_state, new_state):
    "Reagiert auf jede Aenderung des Netz-Sensors, sobald sie um mindestens PV_SURPLUS_LIVE_UPDATE_THRESHOLD_KW vom letzten verarbeiteten Wert abweicht - fuer Sensoren, die alle paar Sekunden aktualisieren, statt auf den naechsten 5-Minuten-Tick zu warten."
    with app.app_context():
        try:
            raw_state = (new_state or {}).get("state")
            unit = ((new_state or {}).get("attributes") or {}).get("unit_of_measurement")
            value, _ = convert_to_expected_unit("photovoltaic_powerflow_grid", raw_state, unit)
            new_kw = float(value)
        except (TypeError, ValueError):
            return
        last_kw = _last_live_grid_kw["value"]
        _last_live_grid_kw["value"] = new_kw
        if last_kw is not None and abs(new_kw - last_kw) < PV_SURPLUS_LIVE_UPDATE_THRESHOLD_KW:
            return
        try:
            run_pv_surplus_charging_tick()
        except Exception as e:
            print("[Shyft] Live-getriggerter PV-Ueberschuss-Tick fehlgeschlagen:", repr(e))


def _on_wallbox_state_live_update(entity_id, old_state, new_state):
    "Reagiert sofort auf einen geaenderten Wallbox-Verbindungsstatus: loggt ihn fuer die Anwesenheitsprognose (die aktuelle Stunde spiegelt beim naechsten Abruf ohnehin den Live-Status, aber ein sofortiger Log-Eintrag verbessert die Verweildauer-Genauigkeit fuer die Sicherheitsheuristik) und wertet die PV-Ueberschuss-Regelung neu aus (z.B. sofortiger Stopp statt bis zu 5 Minuten Verzoegerung, wenn das Auto gerade abgesteckt wurde)."
    with app.app_context():
        try:
            sync_car_presence_log()
        except Exception as e:
            print("[Shyft] Live-getriggertes Anwesenheits-Log fehlgeschlagen:", repr(e))
        try:
            run_pv_surplus_charging_tick()
        except Exception as e:
            print("[Shyft] Live-getriggerter PV-Ueberschuss-Tick (Wallbox-Aenderung) fehlgeschlagen:", repr(e))


live_entity_watcher.register("photovoltaic_powerflow_grid", _on_grid_power_live_update)
live_entity_watcher.register("wallbox_plugged", _on_wallbox_state_live_update)


scheduler = BackgroundScheduler()
scheduler.add_job(sync_sensors_periodically, 'cron', minute="55")
scheduler.add_job(sync_pv_history_periodically, 'cron', hour="21", minute="0")
# same tick as process_shyft_actions_periodically's on-the-hour run, but only hourly - the
# Dashboard tab's chart data doesn't change more often than that
scheduler.add_job(sync_dashboard_chart_data_periodically, 'cron', minute="0")
# on the hour and every 15 min after - actions can be created mid-hour for the current hour
# and start immediately, so a coarser schedule would miss those until the next hour
scheduler.add_job(process_shyft_actions_periodically, 'cron', minute="0,15,30,45")
# on the hour, alongside the other hourly syncs - one snapshot per hour is exactly the
# resolution the Anwesenheitsprognose needs (see compute_car_presence_forecast)
scheduler.add_job(sync_car_presence_log_periodically, 'cron', minute="0")
# PV-Überschussladen-Regelkreis - alle 5 Minuten, siehe run_pv_surplus_charging_tick
scheduler.add_job(run_pv_surplus_charging_tick_periodically, 'interval', minutes=5)
# einmal taeglich erneut versuchen, solange noch keine Batterie-Vorzeichen-Konvention erkannt
# wurde (siehe maybe_detect_battery_flow_sign_convention) - z.B. weil bei der Ersteinrichtung noch
# nicht genug Lade-/Entladewechsel in der Historie vorlagen
scheduler.add_job(maybe_detect_battery_flow_sign_convention_periodically, 'cron', hour="3", minute="30")
scheduler.start()


if __name__ == "__main__":
    try:
        with open(OPTIONS_PATH, "r") as f:
            options = json.load(f)
            SHYFT_ACCESS_KEY = options.get("shyft_access_key", SHYFT_ACCESS_KEY)
            DETAILED_LOGGING = options.get("detailed_logging", DETAILED_LOGGING)
        if not os.path.exists(CONFIG_PATH):
            print("File does not exists")
            shutil.copy("www/defaultShyftConfig.json", CONFIG_PATH)
        else:
            print("File does already exists. nothing was copied")  ##

    except Exception as e:
        print("Failed to load config from options.json:", e)

    # set_access_key statt bubble_token/development_mode einzeln zu setzen: die Umgebung (Prod/Test)
    # ergibt sich allein aus einem evtl. DEV_ACCESS_KEY_PREFIX-Praefix im Schluessel selbst (siehe
    # constants.py) - es gibt bewusst keine eigene development_mode-Konfigurationsoption mehr, die
    # jeder Nutzer in der Addon-Konfiguration haette umschalten koennen.
    shyft_adapter.set_access_key(SHYFT_ACCESS_KEY)
    shyft_adapter.detailed_logging = DETAILED_LOGGING;

    homeassistant_adapter.detailed_logging = DETAILED_LOGGING
    print("TOKEN FOR HAOS_API", mask_secret(SUPERVISOR_TOKEN))
    print("Loaded SHYFT_ACCESS_KEY:", mask_secret(SHYFT_ACCESS_KEY), "- Testumgebung" if shyft_adapter.development_mode else "- Produktivumgebung")
    print("Detailed logging:", DETAILED_LOGGING)

    try:
        sync_all_auto_managed_scripts()
    except Exception as e:
        print("Failed to sync auto-managed scripts at startup:", repr(e))

    try:
        sync_dashboard_chart_data()
    except Exception as e:
        print("Failed to sync dashboard chart data at startup:", repr(e))

    try:
        sync_car_presence_log()
    except Exception as e:
        print("Failed to sync car presence log at startup:", repr(e))

    try:
        run_pv_surplus_charging_tick()
    except Exception as e:
        print("Failed to run PV-Überschussladen tick at startup:", repr(e))

    try:
        maybe_detect_battery_flow_sign_convention()
    except Exception as e:
        print("Failed to detect battery flow sign convention at startup:", repr(e))

    live_entity_watcher.start()

    app.run(host="0.0.0.0", port=8080)
