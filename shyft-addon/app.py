from sync_service import SyncService
from homeassistant_adapter import HomeAssistantAdapter
from shyft_adapter import ShyftAdapter
from version import VERSION

import os
from flask import Flask, send_from_directory, jsonify, request, Response
import requests
import json
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
# HASSIO_URI = HASSIO_URI_RUNNING_REMOTE
HASSIO_URI = HASSIO_URI_RUNNING_ON_HAOS

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
            "label": item["entity_id"] + ": " + item["state"] + " " + unitOfMeasurement,
            "device_class": attributes.get("device_class", ""),
            "state": item["state"],
        })
    return jsonify(result)


@app.route("/config", methods=["PUT"])
def writeConfig():
    content = request.get_data(as_text=True)
    data = json.loads(content)

    # iterate over key/value pairs. integrationMappings holds lists (multi-select), the rest hold plain strings
    for key, value in data.items():
        for inner_key, inner_value in value.items():
            if isinstance(inner_value, str):
                data[key][inner_key] = inner_value.split(":", 1)[0]

    result = json.dumps(data)
    with open(CONFIG_PATH, "w") as file:
        file.write(result)

    return result

def postToHA(path, body):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {SUPERVISOR_TOKEN}"
    }
    completeUri = HASSIO_URI + path
    response = requests.post(completeUri, headers=headers, json=body)
    return response.json()


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
