from sync_service import SyncService
from homeassistant_adapter import HomeAssistantAdapter
from shyft_adapter import ShyftAdapter

import os
from flask import Flask, send_from_directory, jsonify, request, Response
import json
import math
import re
import shutil
import time
from datetime import datetime, timezone
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
DEVELOPMENT_MODE = False
OPTIONS_PATH = "/data/options.json"
CONFIG_PATH = "/data/config.json"
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
    return sync_sensors()

def sync_sensors():
    "Step 1 04 hourly run ha addon"
    return sync_service.sync_all_sensors()

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
    "Pulls the action queue from shyft-power for display in the Gerätesteuerung tab (the actual execution against devices happens separately in process_shyft_actions)."
    user_id = extract_shyft_user_id(shyft_adapter.bubble_token)
    if not user_id:
        return jsonify({"status": "error", "message": "Kein gültiger Shyft-Access-Key konfiguriert."})
    return jsonify(shyft_adapter.get_actions(user_id))


def mapToResponse(response):
    result = []
    for item in response:
        attributes = item.get("attributes", {})
        unitOfMeasurement = attributes.get("unit_of_measurement", "")
        result.append({
            "entity_id": item["entity_id"],
            "label": item["entity_id"] + " (" + item["state"] + " " + unitOfMeasurement + ")",
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
        if control["type"] != "number":
            continue
        try:
            sync_number_script(control_key, sensor_mappings.get(control["sensor_field"], ""))
        except Exception as e:
            print(f"[Shyft] Startup-Sync fuer '{control_key}' fehlgeschlagen:", repr(e))


def execute_auto_managed_action(control_key, phase, target_value):
    "Executes the concrete Start/Ende-Verhalten for a direct-entity-control Aktionstyp (see AUTO_MANAGED_CONTROLS)."
    control = AUTO_MANAGED_CONTROLS[control_key]
    entity_id = _read_current_config().get("sensorMappings", {}).get(control["sensor_field"], "")
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


def get_wallbox_device_id():
    "Best-effort device id of the currently selected Wallbox integration's own device - mirrors getWallboxDevices() in app.js, used server-side as a fallback when a stored device_id is missing."
    config = _read_current_config()
    selected_ids = config.get("integrationMappings", {}).get("wallbox", [])
    if not selected_ids:
        return None
    try:
        device_map = homeassistant_adapter.get_integrations_and_entities().get("deviceMap", {})
    except Exception as e:
        print("[Shyft] Konnte Wallbox-Geraet nicht ermitteln:", repr(e))
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


def call_recipe_stage(stage, branch_key=None, extra_data=None):
    """Calls one configured 'Auto laden' recipe stage's Home Assistant service with its shared
    fields (the same for every call, e.g. device_id) plus whichever branch-specific fields apply
    for branch_key (e.g. phaseCount's "1"/"3", or control's "start"/"stop") - see
    buildBranchedStageFields in app.js for how these are configured. A field only needs a branch
    split at all if it has a fixed set of choices (a Home Assistant "select" selector) that
    differs by branch, e.g. easee.action_command's action_command being "start" vs "stop"; static
    fields like device_id are the same in sharedFields regardless of branch. extra_data overrides
    on top of that - used by the amperage stage to inject the freshly computed Ampere value into
    each of its configured amountFields, since a service can have more than one number field (e.g.
    Easee's set_charger_dynamic_limit also has a time_to_live) and only some of them mean "current".
    """
    service = (stage or {}).get("service", "")
    if not service or "." not in service:
        raise Exception("Kein Befehl (Service) konfiguriert")
    domain, service_name = service.split(".", 1)

    data = dict((stage.get("sharedFields") or {}))
    data.update((stage.get("branchFields") or {}).get(branch_key, {}))
    if extra_data:
        data.update(extra_data)

    # safety net: the frontend fills device_id in from the selected Wallbox's own device at save
    # time, but a config saved before that existed (or before a device was detectable) can still
    # have it empty - re-derive it fresh here rather than depending on the user re-triggering a save
    if not data.get("device_id"):
        fallback_device_id = get_wallbox_device_id()
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


def execute_car_charge_start(target_kw):
    config = _read_current_config()
    recipe = config.get("carChargeRecipe", {})
    if recipe.get("type") != "three_stage":
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


def execute_car_charge_stop():
    config = _read_current_config()
    recipe = config.get("carChargeRecipe", {})
    call_recipe_stage(recipe.get("control", {}), branch_key="stop")


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
                # a "number" selector has no fixed choices to pick from - the "Amperezahl setzen"
                # stage offers each of these as a candidate the user can mark to receive the
                # computed Ampere value at call time (see amountFields in buildBranchedStageFields
                # in app.js) - a service can have more than one, and not all of them mean "current"
                # (e.g. Easee's set_charger_dynamic_limit also has an unrelated time_to_live)
                is_number_field = bool((field_info.get("selector") or {}).get("number"))
                fields.append({
                    "name": field_name,
                    "label": field_info.get("name") or field_name,
                    "options": extract_select_options(field_info),
                    "isDevice": is_device_field,
                    "isNumber": is_number_field,
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
    if recipe.get("type") != "three_stage":
        return jsonify({"success": False, "message": "Keine Variante ausgewählt"}), 400

    body = request.get_json(force=True, silent=True) or {}
    target_kw = body.get("targetKw")
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
    try:
        call_recipe_stage(recipe.get("control", {}), branch_key="stop")
        return jsonify({"success": True})
    except RecipeCallError as e:
        log_error_to_shyft("car_charge_stop_test", "service_call_failed", str(e), service_called=e.service, data_sent=e.data)
        return jsonify({"success": False, "message": str(e)}), 500
    except Exception as e:
        log_error_to_shyft("car_charge_stop_test", classify_error(str(e)), str(e))
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
    data.update(incoming)

    script_sync_errors = {}
    for control_key, control in AUTO_MANAGED_CONTROLS.items():
        if control["type"] != "number":
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

    response_data = dict(data)
    response_data["scriptSyncErrors"] = script_sync_errors
    return jsonify(response_data)


@app.route("/actions/<control_key>/status", methods=["GET"])
def statusAutoManagedControl(control_key):
    control = AUTO_MANAGED_CONTROLS.get(control_key)
    if not control:
        return jsonify({"error": "unbekannte Steuerung"}), 404

    entity_id = _read_current_config().get("sensorMappings", {}).get(control["sensor_field"], "")
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

    entity_id = _read_current_config().get("sensorMappings", {}).get(control["sensor_field"], "")
    if not entity_id:
        return jsonify({"success": False, "message": "Keine Entity zugeordnet"}), 400

    body = request.get_json(force=True, silent=True) or {}

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
    else:  # switch
        turn_on = body.get("on", True)
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


def handle_shyft_action_start(action, actions_enabled, config):
    "For direct-entity-control Aktionstypen (see AUTO_MANAGED_CONTROLS) this really executes; everything else is still a placeholder pending a later step."
    label = action.get("Action Name", "?")
    target = action.get("Target Value")
    control_key = ACTION_NAME_TO_CONTROL_KEY.get(label)

    if not actions_enabled:
        print(f"[Shyft] Start faellig fuer '{label}' (Ziel: {target}) - Aktionstyp ist deaktiviert, nur simuliert.")
    elif label == "Auto laden":
        try:
            execute_car_charge_start(target)
            print(f"[Shyft] Start ausgefuehrt fuer '{label}' (Ziel: {target} kW).")
        except Exception as e:
            print(f"[Shyft] Start fuer '{label}' fehlgeschlagen: {e!r}")
    elif control_key:
        try:
            execute_auto_managed_action(control_key, "start", target)
            print(f"[Shyft] Start ausgefuehrt fuer '{label}' (Ziel: {target}).")
        except Exception as e:
            print(f"[Shyft] Start fuer '{label}' fehlgeschlagen: {e!r}")
    else:
        print(f"[Shyft] Start faellig fuer '{label}' (Ziel: {target}) - Ausfuehrung pro Aktion noch nicht implementiert.")

    notify_action_event(config, action, "gestartet" if actions_enabled else "gestartet (nur simuliert)")


def handle_shyft_action_end(action, actions_enabled, config):
    "For direct-entity-control Aktionstypen (see AUTO_MANAGED_CONTROLS) this really executes; everything else is still a placeholder pending a later step."
    label = action.get("Action Name", "?")
    control_key = ACTION_NAME_TO_CONTROL_KEY.get(label)

    if not actions_enabled:
        print(f"[Shyft] Ende faellig fuer '{label}' - Aktionstyp ist deaktiviert, nur simuliert.")
    elif label == "Auto laden":
        try:
            execute_car_charge_stop()
            print(f"[Shyft] Ende ausgefuehrt fuer '{label}'.")
        except Exception as e:
            print(f"[Shyft] Ende fuer '{label}' fehlgeschlagen: {e!r}")
    elif control_key:
        try:
            execute_auto_managed_action(control_key, "end", None)
            print(f"[Shyft] Ende ausgefuehrt fuer '{label}'.")
        except Exception as e:
            print(f"[Shyft] Ende fuer '{label}' fehlgeschlagen: {e!r}")
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


def sync_sensors_periodically():
    with app.app_context():
        sync_sensors()

def sync_pv_history_periodically():
    with app.app_context():
        sync_pv_history()

def process_shyft_actions_periodically():
    with app.app_context():
        process_shyft_actions()


scheduler = BackgroundScheduler()
scheduler.add_job(sync_sensors_periodically, 'cron', minute="55")
scheduler.add_job(sync_pv_history_periodically, 'cron', hour="21", minute="0")
# on the hour and every 15 min after - actions can be created mid-hour for the current hour
# and start immediately, so a coarser schedule would miss those until the next hour
scheduler.add_job(process_shyft_actions_periodically, 'cron', minute="0,15,30,45")
scheduler.start()


if __name__ == "__main__":
    try:
        with open(OPTIONS_PATH, "r") as f:
            options = json.load(f)
            SHYFT_ACCESS_KEY = options.get("shyft_access_key", SHYFT_ACCESS_KEY)
            DETAILED_LOGGING = options.get("detailed_logging", DETAILED_LOGGING)
            DEVELOPMENT_MODE = options.get("development_mode", DEVELOPMENT_MODE)
        if not os.path.exists(CONFIG_PATH):
            print("File does not exists")
            shutil.copy("www/defaultShyftConfig.json", CONFIG_PATH)
        else:
            print("File does already exists. nothing was copied")  ##

    except Exception as e:
        print("Failed to load config from options.json:", e)

    shyft_adapter.bubble_token = SHYFT_ACCESS_KEY;
    shyft_adapter.detailed_logging = DETAILED_LOGGING;
    shyft_adapter.development_mode = DEVELOPMENT_MODE;

    homeassistant_adapter.detailed_logging = DETAILED_LOGGING
    print("TOKEN FOR HAOS_API", mask_secret(SUPERVISOR_TOKEN))
    print("Loaded SHYFT_ACCESS_KEY:", mask_secret(SHYFT_ACCESS_KEY))
    print("Detailed logging:", DETAILED_LOGGING)

    try:
        sync_all_auto_managed_scripts()
    except Exception as e:
        print("Failed to sync auto-managed scripts at startup:", repr(e))

    app.run(host="0.0.0.0", port=8080)
