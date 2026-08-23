from typing import Any

from constants import HOMEASSISTANT_URI

from datetime import datetime
import requests
import websocket
import json
import logging
import urllib.parse

UNIT_OF_MEASUREMENT_W = "W"
UNIT_OF_MEASUREMENT_KW = "kW"
DEFAULT_UNIT_OF_MEASUREMENT = UNIT_OF_MEASUREMENT_KW
WEBSOCKET_PATH = "/websocket"

logger = logging.getLogger(__name__)


class PeriodElement:
    def __init__(self, state: str, last_changed: datetime):
        self.state = state
        self.last_changed = last_changed

    def __eq__(self, other):
        if not isinstance(other, PeriodElement):
            return False

        return self.state == other.state and self.last_changed == other.last_changed

    def __str__(self):
        return f"{self.state} {self.last_changed}"

    def __repr__(self):
        return self.__str__()


class EntityState:
    def __init__(self, state: str, unit: str):
        self.state = state
        self.unit = unit


# Adapter for integrating homeassistant
class HomeAssistantAdapter:

    def __init__(self,
                 supervisor_token: str,
                 homeassistant_uri: str = HOMEASSISTANT_URI,
                 bucket_size_in_minutes: int = 20):
        self.homeassistant_uri = homeassistant_uri
        self.supervisor_token = supervisor_token
        self.detailed_logging = False
        self._bucket_size_in_minutes = bucket_size_in_minutes

    def load_entity_state(self,
                          sensor_id: str):

        query = "/api/states/" + sensor_id
        self._log_info("load_entity_state query " + query)
        response = self.get_from_homeassistant(query)
        unit = response.get("attributes", {}).get("unit_of_measurement", "")
        self._log_info("load_entity_state result " + str(response))
        return EntityState(response["state"], unit)

    def load_entity_history(self, sensor_id: str,
                            start_timestamp: datetime,
                            end_timestamp: datetime) -> [PeriodElement]:
        # start_timestamp sits in the URL PATH (before "?"), where a literal "+" (from the UTC
        # offset, e.g. "+00:00") is not touched by query-string decoding, so it round-trips fine
        # unescaped. end_time/filter_entity_id sit in the QUERY STRING though, where Home
        # Assistant's request parsing treats "+" as a space (standard
        # application/x-www-form-urlencoded semantics) - without escaping, "...+00:00" silently
        # becomes "... 00:00", which HA then rejects as an invalid end_time. quote() with an empty
        # safe-set escapes "+" (and ":") to their %XX form so they decode back correctly.
        end_time_encoded = urllib.parse.quote(end_timestamp.isoformat(), safe="")
        sensor_id_encoded = urllib.parse.quote(sensor_id, safe="")
        query = "/api/history/period/" + start_timestamp.isoformat() + "?end_time=" + end_time_encoded + "&filter_entity_id=" + sensor_id_encoded + "&minimal_response"
        self._log_info("load_entity_history query " + query)
        response = self.get_from_homeassistant(query)
        self._log_info("load_entity_history result " + str(response))
        result = self._map_to_period_element(response)

        return result

    def _log_info(self, log_message: str):
        if self.detailed_logging:
            logger.info(log_message)

    def _map_to_period_element(self, response) -> [PeriodElement]:
        if not isinstance(response, list):
            # HA's history endpoint returns a list of lists on success; anything else (e.g. an
            # error dict like {"message": "Invalid end_time"}) means the request itself failed -
            # raise clearly here instead of letting a confusing KeyError(0)/TypeError surface
            # further up.
            raise Exception(f"Unexpected history response from Home Assistant (expected a list): {response}")
        time_buckets = {}
        unit = DEFAULT_UNIT_OF_MEASUREMENT
        try:
            unit = response[0][0]['attributes']['unit_of_measurement']
        except (IndexError, KeyError, TypeError):
            # silent skip. if nothing can be found then we use kw
            self._log_info("Attention! It was not possible to read the unit_of_measurement. kW is assumed")
            pass
        for response_entry in response:
            for one_period in response_entry:
                state = one_period["state"]
                last_changed = datetime.fromisoformat(one_period["last_changed"])
                last_changed_bucket = self._map_datetime_to_bucket_time(last_changed)
                if last_changed_bucket not in time_buckets:
                    time_buckets[last_changed_bucket] = PeriodElement(self._calculate_state(state, unit),
                                                                      last_changed_bucket)

        return list(time_buckets.values())

    def _calculate_state(self, state: str, unit: str) -> Any:
        try:
            if (unit == UNIT_OF_MEASUREMENT_W):
                return f"{float(state) / 1000:.4f}"
            return state
        except (ValueError, TypeError):
            # Fallback if state is None, "unknown", or not a number
            return state

    def _map_datetime_to_bucket_time(self, value: datetime) -> datetime:
        minutes_rounded = (value.minute // self._bucket_size_in_minutes) * self._bucket_size_in_minutes
        return value.replace(minute=minutes_rounded, second=0, microsecond=0)

    def get_integrations_and_entities(self):
        "Loads HA config entries (integrations), the entity registry and the device registry via the websocket API and maps each integration to its entity_ids"
        ws_uri = self.homeassistant_uri.replace("https://", "wss://").replace("http://", "ws://") + WEBSOCKET_PATH
        ws = websocket.create_connection(ws_uri)
        try:
            ws.recv()  # auth_required
            ws.send(json.dumps({"type": "auth", "access_token": self.supervisor_token}))
            auth_response = json.loads(ws.recv())
            if auth_response.get("type") != "auth_ok":
                raise Exception("Home Assistant websocket authentication failed")

            config_entries = self._ws_command(ws, 1, "config_entries/get")
            entities = self._ws_command(ws, 2, "config/entity_registry/list")
            devices = self._ws_command(ws, 3, "config/device_registry/list")
        finally:
            ws.close()

        return self._build_integrations_and_entities(config_entries, entities, devices)

    def _ws_command(self, ws, msg_id, command_type):
        ws.send(json.dumps({"id": msg_id, "type": command_type}))
        response = json.loads(ws.recv())
        if not response.get("success"):
            raise Exception(f"Home Assistant websocket command {command_type} failed: {response}")
        return response["result"]

    def _build_integrations_and_entities(self, config_entries, entities, devices):
        integration_list = []
        entity_map = {}
        device_map = {}
        for entry in config_entries:
            entry_id = entry["entry_id"]
            domain = entry.get("domain", "")
            title = entry.get("title") or domain or entry_id
            name = f"{title} ({domain})" if domain else title
            integration_list.append({"id": entry_id, "name": name})
            entity_map[entry_id] = []
            device_map[entry_id] = []

        device_to_entries = {device["id"]: device.get("config_entries", []) for device in devices}

        for entity in entities:
            entry_ids = []
            if entity.get("config_entry_id"):
                entry_ids.append(entity["config_entry_id"])
            elif entity.get("device_id"):
                entry_ids.extend(device_to_entries.get(entity["device_id"], []))

            for entry_id in entry_ids:
                if entry_id in entity_map and entity["entity_id"] not in entity_map[entry_id]:
                    entity_map[entry_id].append(entity["entity_id"])

        # needed so a service field with a "device" selector (e.g. easee.set_charger_phase_mode's
        # device_id) can be auto-filled from the already-selected Wallbox integration instead of
        # asking the user to type a device registry id they'd have no way to look up themselves
        for device in devices:
            device_name = device.get("name_by_user") or device.get("name") or device["id"]
            for entry_id in device.get("config_entries", []):
                if entry_id in device_map:
                    device_map[entry_id].append({"id": device["id"], "name": device_name})

        integration_list.sort(key=lambda i: i["name"].lower())
        return {"integrations": integration_list, "entityMap": entity_map, "deviceMap": device_map}

    def get_from_homeassistant(self, path):
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": f"Bearer {self.supervisor_token}"
        }
        completeUri = self.homeassistant_uri + path
        response = requests.get(completeUri, headers=headers)
        try:
            return response.json()
        except:
            raise Exception(response.text)

    def post_to_homeassistant(self, path, json_body=None):
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.supervisor_token}"
        }
        completeUri = self.homeassistant_uri + path
        response = requests.post(completeUri, headers=headers, json=json_body if json_body is not None else {})
        if not response.ok:
            raise Exception(f"POST {path} failed: {response.status_code} {response.text}")
        try:
            return response.json()
        except ValueError:
            return {}

    def delete_from_homeassistant(self, path):
        headers = {"Authorization": f"Bearer {self.supervisor_token}"}
        completeUri = self.homeassistant_uri + path
        response = requests.delete(completeUri, headers=headers)
        if not response.ok and response.status_code != 404:
            raise Exception(f"DELETE {path} failed: {response.status_code} {response.text}")

    def put_script_config(self, script_id, config):
        "Creates or updates a Home Assistant script via the config REST API (the same endpoint the UI script editor uses)"
        return self.post_to_homeassistant(f"/api/config/script/config/{script_id}", config)

    def delete_script_config(self, script_id):
        self.delete_from_homeassistant(f"/api/config/script/config/{script_id}")

    def call_service(self, domain, service, data=None):
        return self.post_to_homeassistant(f"/api/services/{domain}/{service}", data)

    def get_mobile_app_notify_targets(self):
        "Lists Home Assistant's notify services for paired phones (Mobile App integration, one service per device: notify.mobile_app_<device>) - these are services, not entities."
        response = self.get_from_homeassistant("/api/services")
        notify_domain = next((d for d in response if d.get("domain") == "notify"), None)
        services = notify_domain.get("services", {}) if notify_domain else {}
        targets = []
        for service_name in services:
            if service_name.startswith("mobile_app_"):
                label = service_name[len("mobile_app_"):].replace("_", " ").strip().title() or service_name
                targets.append({"service": service_name, "label": label})
        targets.sort(key=lambda t: t["label"].lower())
        return targets

    def send_notification(self, target, message):
        "Sends a push notification via Home Assistant's notify integration. `target` is either a notify.* entity id (uses notify.send_message) or a bare legacy notify service name (e.g. mobile_app_my_phone)."
        if not target:
            return
        if target.startswith("notify."):
            self.call_service("notify", "send_message", {"entity_id": target, "message": message})
        else:
            self.call_service("notify", target, {"message": message})

    def read_entity_numeric_value(self, entity_id):
        "Reads the current numeric value of an entity - the target temperature attribute for climate entities, the state for number entities"
        response = self.get_from_homeassistant(f"/api/states/{entity_id}")
        domain = entity_id.split(".")[0]
        if domain == "climate":
            value = response.get("attributes", {}).get("temperature")
        else:
            value = response.get("state")
        return float(value)
