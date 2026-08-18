from sync_service import SyncService
from homeassistant_adapter import HomeAssistantAdapter
from shyft_adapter import ShyftAdapter
from version import VERSION

import os
from flask import Flask, send_from_directory, jsonify, request, Response
import json
import re
import time
import shutil
from apscheduler.schedulers.background import BackgroundScheduler
import logging
import sys


logging.basicConfig(stream=sys.stdout, level=logging.INFO)
app = Flask(__name__, static_folder="www", static_url_path="")

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
        })
    return jsonify(result)


def build_heating_target_temp_script_config(entity_id):
    "Builds a script that sets entity_id to a target_temperature passed in at call time - mirrors blueprints/heizung_soll_temperatur.yaml"
    domain = entity_id.split(".")[0]
    if domain == "number":
        action = {
            "action": "number.set_value",
            "target": {"entity_id": entity_id},
            "data": {"value": "{{ target_temperature }}"}
        }
    elif domain == "climate":
        action = {
            "action": "climate.set_temperature",
            "target": {"entity_id": entity_id},
            "data": {"temperature": "{{ target_temperature }}"}
        }
    else:
        return None

    return {
        "alias": "Shyft: Heizung Soll-Temperatur",
        "fields": {
            "target_temperature": {
                "name": "Zieltemperatur",
                "description": "Die von Shyft berechnete Soll-Temperatur in °C.",
                "selector": {"number": {"min": 0, "max": 100, "step": 0.5}}
            }
        },
        "sequence": [action]
    }


def sync_heating_target_temp_script(entity_id):
    "Creates/updates or removes the auto-managed script so it always targets the currently mapped entity. Returns the resulting actorMappings value."
    if not entity_id:
        homeassistant_adapter.delete_script_config(HEATING_TARGET_TEMP_SCRIPT_ID)
        homeassistant_adapter.call_service("script", "reload")
        return ""

    config = build_heating_target_temp_script_config(entity_id)
    if config is None:
        raise Exception(f"Entity {entity_id} ist weder eine number- noch eine climate-Entity")

    homeassistant_adapter.put_script_config(HEATING_TARGET_TEMP_SCRIPT_ID, config)
    # writing the config alone doesn't make HA (re-)register the script entity - it needs an explicit reload
    homeassistant_adapter.call_service("script", "reload")
    return f"script.{HEATING_TARGET_TEMP_SCRIPT_ID}"


@app.route("/config", methods=["PUT"])
def writeConfig():
    content = request.get_data(as_text=True)
    data = json.loads(content)

    # iterate over key/value pairs. integrationMappings holds lists (multi-select), the rest hold plain strings.
    # entity ids never contain ":" or whitespace, so splitting on the first one strips both the old
    # "entity_id: state unit" and the current "entity_id (state unit)" display formats.
    for key, value in data.items():
        for inner_key, inner_value in value.items():
            if isinstance(inner_value, str):
                data[key][inner_key] = re.split(r"[:\s]", inner_value, maxsplit=1)[0]

    script_sync_errors = {}
    heating_entity = data.get("sensorMappings", {}).get("heatpump_heating_target_temp_normal", "")
    try:
        script_entity_id = sync_heating_target_temp_script(heating_entity)
        if "actorMappings" in data:
            data["actorMappings"]["heating_target_temp"] = script_entity_id
    except Exception as e:
        script_sync_errors["heating_target_temp"] = str(e)

    with open(CONFIG_PATH, "w") as file:
        file.write(json.dumps(data))

    response_data = dict(data)
    response_data["scriptSyncErrors"] = script_sync_errors
    return jsonify(response_data)


@app.route("/actions/heating_target_temp/status", methods=["GET"])
def statusHeatingTargetTemp():
    entity_id = _read_current_config().get("sensorMappings", {}).get("heatpump_heating_target_temp_normal", "")
    if not entity_id:
        return jsonify({"configured": False})

    script_entity_id = f"script.{HEATING_TARGET_TEMP_SCRIPT_ID}"
    script_state = homeassistant_adapter.get_from_homeassistant(f"/api/states/{script_entity_id}")
    if not isinstance(script_state, dict) or "state" not in script_state:
        return jsonify({
            "configured": True,
            "entity_id": entity_id,
            "value": None,
            "error": f"{script_entity_id} wurde noch nicht angelegt. Speichere die Zieltemperatur-Entity erneut oder prüfe die Addon-Logs."
        })

    try:
        value = homeassistant_adapter.read_entity_numeric_value(entity_id)
        return jsonify({"configured": True, "entity_id": entity_id, "value": value})
    except Exception as e:
        return jsonify({"configured": True, "entity_id": entity_id, "value": None, "error": str(e)})


@app.route("/actions/heating_target_temp/test", methods=["POST"])
def testHeatingTargetTemp():
    body = request.get_json(force=True, silent=True) or {}
    delta = body.get("delta", 0)

    entity_id = _read_current_config().get("sensorMappings", {}).get("heatpump_heating_target_temp_normal", "")
    if not entity_id:
        return jsonify({"success": False, "message": "Keine Zieltemperatur-Entity zugeordnet"}), 400

    try:
        current_value = homeassistant_adapter.read_entity_numeric_value(entity_id)
        new_value = current_value + delta
        homeassistant_adapter.call_service("script", HEATING_TARGET_TEMP_SCRIPT_ID, {"target_temperature": new_value})
        time.sleep(1.5)
        confirmed_value = homeassistant_adapter.read_entity_numeric_value(entity_id)
        return jsonify({"success": True, "value": confirmed_value})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


def _read_current_config():
    with open(CONFIG_PATH, "r") as file:
        return json.load(file)


def sync_sensors_periodically():
    with app.app_context():
        sync_sensors()

def sync_pv_history_periodically():
    with app.app_context():
        sync_pv_history()


scheduler = BackgroundScheduler()
scheduler.add_job(sync_sensors_periodically, 'cron', minute="55")
scheduler.add_job(sync_pv_history_periodically, 'cron', hour="21", minute="0")
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

    app.run(host="0.0.0.0", port=8080)
