import json
import time
import threading
import logging

import websocket

from homeassistant_adapter import WEBSOCKET_PATH

logger = logging.getLogger(__name__)

# How long a single Websocket connection is kept open before it's deliberately dropped and
# re-established - not just resilience against silent disconnects, but also the mechanism by
# which a changed sensorMappings entry (e.g. the user re-points "Aktueller Strom - Netz" at a
# different entity) takes effect without an addon restart, since the entity list is re-resolved
# from the current config on every (re)connect.
MAX_CONNECTION_SECONDS = 1800
RECONNECT_DELAY_SECONDS = 15
# how long to wait before re-checking the config when there's currently nothing to watch (e.g. no
# relevant sensor mapped yet) - avoids a tight empty loop
IDLE_RECHECK_SECONDS = 60


class LiveEntityWatcher:
    """Persistent Home Assistant Websocket-Verbindung, die auf Zustandsänderungen bestimmter
    Sensoren reagiert (Home Assistants "subscribe_trigger" mit einem "state"-Trigger, serverseitig
    schon auf die gewünschten entity_ids gefiltert - kein Firehose aller state_changed-Events).

    Handler werden nicht gegen eine feste entity_id registriert, sondern gegen einen
    sensorMappings-Key (z.B. "photovoltaic_powerflow_grid") - die tatsächliche entity_id wird bei
    jedem (Re-)Connect frisch aus der aktuellen Config aufgelöst, damit eine geänderte
    Sensor-Zuordnung ohne Addon-Neustart wirkt.

    Läuft in einem eigenen Daemon-Thread; verbindet sich automatisch neu bei Verbindungsabbruch,
    Auth-Fehlern, oder wenn schlicht noch kein passender Sensor zugeordnet ist.
    """

    def __init__(self, homeassistant_adapter, config_reader):
        self.homeassistant_adapter = homeassistant_adapter
        self.config_reader = config_reader
        self.handlers = {}  # sensorMappings-Key -> [callback(entity_id, old_state, new_state)]
        self._stop = False
        self._thread = None

    def register(self, sensor_mapping_key, callback):
        "callback(entity_id, old_state, new_state) - old_state/new_state sind volle HA-State-Dicts ({'state', 'attributes', ...}) oder None."
        self.handlers.setdefault(sensor_mapping_key, []).append(callback)

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop = False
        self._thread = threading.Thread(target=self._run_forever, daemon=True, name="ha-live-entity-watcher")
        self._thread.start()

    def stop(self):
        self._stop = True

    def _resolve_entity_to_keys(self):
        "entity_id -> [sensorMappings-Keys mit registriertem Handler, die aktuell auf diese entity_id zeigen]."
        config = self.config_reader()
        mappings = config.get("sensorMappings", {})
        entity_to_keys = {}
        for key in self.handlers:
            entity_id = mappings.get(key)
            if entity_id:
                entity_to_keys.setdefault(entity_id, []).append(key)
        return entity_to_keys

    def _run_forever(self):
        while not self._stop:
            try:
                self._connect_and_listen()
            except Exception as e:
                logger.info("Live-Watcher: Verbindung verloren/fehlgeschlagen, naechster Versuch in %ss: %r", RECONNECT_DELAY_SECONDS, e)
            if not self._stop:
                time.sleep(RECONNECT_DELAY_SECONDS)

    def _connect_and_listen(self):
        entity_to_keys = self._resolve_entity_to_keys()
        if not entity_to_keys:
            time.sleep(IDLE_RECHECK_SECONDS)
            return

        ws_uri = self.homeassistant_adapter.homeassistant_uri.replace("https://", "wss://").replace("http://", "ws://") + WEBSOCKET_PATH
        ws = websocket.create_connection(ws_uri, timeout=90)
        try:
            ws.recv()  # auth_required
            ws.send(json.dumps({"type": "auth", "access_token": self.homeassistant_adapter.supervisor_token}))
            auth_response = json.loads(ws.recv())
            if auth_response.get("type") != "auth_ok":
                raise Exception("Websocket-Authentifizierung fehlgeschlagen")

            ws.send(json.dumps({
                "id": 1,
                "type": "subscribe_trigger",
                "trigger": {"platform": "state", "entity_id": list(entity_to_keys.keys())},
            }))
            sub_response = json.loads(ws.recv())
            if not sub_response.get("success"):
                raise Exception(f"subscribe_trigger fehlgeschlagen: {sub_response}")

            logger.info("Live-Watcher verbunden, beobachtet: %s", list(entity_to_keys.keys()))
            connected_since = time.monotonic()

            while not self._stop:
                if time.monotonic() - connected_since > MAX_CONNECTION_SECONDS:
                    return  # regelmaessiger Reconnect - siehe MAX_CONNECTION_SECONDS-Kommentar oben
                raw = ws.recv()
                self._handle_message(raw, entity_to_keys)
        finally:
            try:
                ws.close()
            except Exception:
                pass

    def _handle_message(self, raw, entity_to_keys):
        try:
            message = json.loads(raw)
        except (TypeError, ValueError):
            return
        if message.get("type") != "event":
            return
        trigger = ((message.get("event") or {}).get("variables") or {}).get("trigger") or {}
        entity_id = trigger.get("entity_id")
        if entity_id not in entity_to_keys:
            return
        old_state = trigger.get("from_state")
        new_state = trigger.get("to_state")
        for key in entity_to_keys[entity_id]:
            for callback in self.handlers.get(key, []):
                try:
                    callback(entity_id, old_state, new_state)
                except Exception as e:
                    logger.info("Live-Watcher Handler-Fehler (%s): %r", key, e)
