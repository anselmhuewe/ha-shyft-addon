import json

from constants import BUBBLE_URI_TEST, BUBBLE_URI_PRD,  BUBBLE_TOKEN, DEV_ACCESS_KEY_PREFIX
from homeassistant_adapter import PeriodElement

import requests
import logging

logger = logging.getLogger(__name__)

# Communicates with shyft on bubble
class ShyftAdapter:

    def __init__(self,
                 bubble_token=BUBBLE_TOKEN):
        self.bubble_token = bubble_token
        self.detailed_logging = False
        self.development_mode = False

    def set_access_key(self, raw_access_key):
        """Parst den rohen shyft_access_key (siehe DEV_ACCESS_KEY_PREFIX in constants.py) und setzt
        bubble_token/development_mode gemeinsam - immer diese Methode statt die beiden Attribute
        einzeln zu setzen, sonst koennten sie auseinanderlaufen. Es gibt bewusst keine eigene
        Konfigurationsoption dafuer mehr (siehe app.py) - die Umgebung ergibt sich allein aus dem
        Schluessel."""
        raw_access_key = raw_access_key or ""
        if raw_access_key.startswith(DEV_ACCESS_KEY_PREFIX):
            self.bubble_token = raw_access_key[len(DEV_ACCESS_KEY_PREFIX):]
            self.development_mode = True
        else:
            self.bubble_token = raw_access_key
            self.development_mode = False

    def send_pv_history(self,
                        pv_history: [PeriodElement]):
        payload = self._map_to_json(pv_history)
        return self._call_workflow("addon_pv_history", payload)

    def send_site_data(self, addon_sensor_data_json: str):
        "Sends the consolidated staticConfig+liveValues+EV-forecast JSON to shyft-power (update_site_addon workflow) - replaces the old per-sensor addon_sensor_data workflow (send_sensor_values/sensor_list)."
        return self._call_workflow("update_site_addon", json.dumps({"addon_sensor_data_JSON": addon_sensor_data_json}))

    def send_location(self, latitude, longitude):
        "Sends Home Assistant's zone.home coordinates to shyft-power (update_location_addon workflow) - called on location change or first setup (Verbindung testen), not on the hourly sync."
        return self._call_workflow("update_location_addon", json.dumps({"Latitude": latitude, "Longitude": longitude}))

    def send_error_log(self, payload: dict):
        "Best-effort error report to shyft-power, sent whenever a Test-Button click in the addon returns an error (see log_error_to_shyft in app.py for how the payload is assembled)."
        return self._call_workflow("ha_addon_error_logging", json.dumps(payload))

    def get_actions(self, user_id: str):
        "Pulls the (read-only, for display only for now) action queue for user_id from shyft-power. Unlike _call_workflow, this returns the actual response body since the caller needs the action list."
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.bubble_token}"
            }
            complete_uri = self._create_complete_uri("return_actions_to_addon")
            payload = json.dumps({"user": user_id})
            self._log_info(f"get_actions uri={complete_uri}")
            response = requests.post(complete_uri, headers=headers, data=payload)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"status": "error", "message": str(e)}

    # Bewusst fest verdrahtet auf die Testumgebung (nicht ueber _create_complete_uri/development_mode
    # geroutet) - der Workflow existiert bislang nur dort, unabhaengig davon, gegen welche Umgebung
    # der aktuell hinterlegte (Demo-)Token sonst laeuft. Wenn der Workflow live geht, hier auf
    # _create_complete_uri("create_user_addon") umstellen.
    CREATE_USER_URI = "https://shyft-power.com/version-test/api/1.1/wf/create_user_addon"

    def create_user(self):
        """Signs a new shyft-power account up (create_user_addon workflow) in the background, the
        first time a demo-mode addon user configures a real device (see maybe_create_real_account in
        app.py) - no parameters: Bubble generates its own email/username/password server-side (the
        addon never asks the user for these). Returns the parsed response dict, expected to contain
        'access_key' and a 'has an account' yes/no flag (see maybe_create_real_account for how
        that's interpreted). Raises on a network/HTTP failure, unlike _call_workflow."""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.bubble_token}"
        }
        self._log_info(f"create_user uri={self.CREATE_USER_URI}")
        response = requests.post(self.CREATE_USER_URI, headers=headers, data=json.dumps({}))
        response.raise_for_status()
        return response.json()

    def get_input_output_csv(self, user_id: str):
        "Pulls the optimizer's latest input/output CSV data (used to build the addon's Dashboard-tab charts) for user_id from shyft-power. Like get_actions, returns the actual response body rather than a status string."
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.bubble_token}"
            }
            complete_uri = self._create_complete_uri("provide_input_output_csv")
            payload = json.dumps({"user": user_id})
            self._log_info(f"get_input_output_csv uri={complete_uri}")
            response = requests.post(complete_uri, headers=headers, data=payload)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def _call_workflow(self,
                       workflow_name: str,
                       payload: str):
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.bubble_token}"
            }
            bubble_token_masked= f"{self.bubble_token[:6]}***{self.bubble_token[-1]}"
            complete_uri = self._create_complete_uri(workflow_name)
            self._log_info(f"_call_workflow uri={complete_uri}")
            self._log_info(f"_call_workflow payload={payload}")
            self._log_info(f"_call_workflow bubble_token_masked={bubble_token_masked}")
            response = requests.post(complete_uri, headers=headers, data=payload)
            self._log_info("_call_workflow " + str(response))
            status_code = response.status_code
            return json.dumps({
                "status": "success",
                "payload": payload,
                "external_status": status_code})
        except Exception as e:
            return json.dumps({"status": "error", "message": str(e)})

    def _create_complete_uri(self, workflow_name: str) -> str:
        bubble_uri = BUBBLE_URI_TEST if True == self.development_mode else BUBBLE_URI_PRD
        complete_uri = f"{bubble_uri}api/1.1/wf/{workflow_name}"
        return complete_uri

    def _map_to_json(self, pv_history: [PeriodElement]):
        list_of_values = []
        for one_history_element in pv_history:
            list_of_values.append({"state": one_history_element.state,
                                   "last_changed": one_history_element.last_changed.isoformat()})
        return json.dumps({"pv_history_list": list_of_values})

    def _log_info(self, log_message: str):
        if self.detailed_logging:
            logger.info(log_message)
