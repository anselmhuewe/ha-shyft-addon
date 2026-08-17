from typing import Any

from constants import HOMEASSISTANT_URI

from datetime import datetime
import requests
import websocket
import json
import logging

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
        query = "/api/history/period/" + start_timestamp.isoformat() + "?end_time=" + end_timestamp.isoformat() + "&filter_entity_id=" + sensor_id + "&minimal_response"
        self._log_info("load_entity_history query " + query)
        response = self.get_from_homeassistant(query)
        self._log_info("load_entity_history result " + str(response))
        result = self._map_to_period_element(response)

        return result

    def _log_info(self, log_message: str):
        if self.detailed_logging:
            logger.info(log_message)

    def _map_to_period_element(self, response) -> [PeriodElement]:
        time_buckets = {}
        first_entry = response[0]
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

    def get_devices_and_entities(self):
        "Loads the HA device registry and entity registry via the websocket API and maps each device to its entity_ids"
        ws_uri = self.homeassistant_uri.replace("https://", "wss://").replace("http://", "ws://") + WEBSOCKET_PATH
        ws = websocket.create_connection(ws_uri)
        try:
            ws.recv()  # auth_required
            ws.send(json.dumps({"type": "auth", "access_token": self.supervisor_token}))
            auth_response = json.loads(ws.recv())
            if auth_response.get("type") != "auth_ok":
                raise Exception("Home Assistant websocket authentication failed")

            devices = self._ws_command(ws, 1, "config/device_registry/list")
            entities = self._ws_command(ws, 2, "config/entity_registry/list")
        finally:
            ws.close()

        return self._build_devices_and_entities(devices, entities)

    def _ws_command(self, ws, msg_id, command_type):
        ws.send(json.dumps({"id": msg_id, "type": command_type}))
        response = json.loads(ws.recv())
        if not response.get("success"):
            raise Exception(f"Home Assistant websocket command {command_type} failed: {response}")
        return response["result"]

    def _build_devices_and_entities(self, devices, entities):
        device_list = []
        entity_map = {}
        for device in devices:
            name = device.get("name_by_user") or device.get("name") or device["id"]
            device_list.append({"id": device["id"], "name": name})
            entity_map[device["id"]] = []

        for entity in entities:
            device_id = entity.get("device_id")
            if device_id and device_id in entity_map:
                entity_map[device_id].append(entity["entity_id"])

        device_list.sort(key=lambda d: d["name"].lower())
        return {"devices": device_list, "entityMap": entity_map}

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
