from homeassistant_adapter import HomeAssistantAdapter
from shyft_adapter import ShyftAdapter
from constants import CONFIG_PATH

import json
from datetime import datetime, timedelta

LIST_OF_SENSORS = {
    "photovoltaic_powerflow_pv": "PV - PowerFlow PV",
    "photovoltaic_powerflow_load": "PV - PowerFlow Load",
    "photovoltaic_powerflow_grid": "PV - PowerFlow Grid",
    "photovoltaic_powerflow_battery": "PV - PowerFlow Battery",
    "battery_storage_command_mode": "B - Storage Command Mode",
    "battery_state_of_charge": "B - SOC",
    "battery_charge_limit_current": "B - Charge Limit (current)",
    "battery_discharge_limit_current": "B - Discharge Limit (current)",
    "heatpump_dhw_tank_temp": "HP - DHW Tank Temp",
    "heatpump_dhw_activated": "HP - DHW Activated",
    "heatpump_dhw_on_off": "HP - DHW on/off",
    "heatpump_heating_target_temp_normal": "HP - Heating Target Temp (normal)",
    "heatpump_heating_activated": "HP - Heating Activated",
    "heatpump_current_power_elect": "HP - Current Power (elect)",
    "heatpump_supply_temp_hp": "HP - Supply Temp HP",
    "heatpump_on_off": "HP - On/Off",
    "heatpump_temp_indoor_measured": "HP - Temp Indoor measured",
    "electronicvehicle_state_of_charge": "EV - SOC",
    "wallbox_current_charging_power": "WB - Current Charging Power",
    "wallbox_plugged": "WB - Plugged"
}

# does the mapping between homeassistant and shyft/ bubble
class SyncService:

    def __init__(self,
                 homeassistant_adapter: HomeAssistantAdapter,
                 shyft_adapter: ShyftAdapter,
                 config_path: str = CONFIG_PATH):
        self.homeassistant_adapter = homeassistant_adapter
        self.shyft_adapter = shyft_adapter
        self.config_path = config_path

    def sync_pv_history(self):
        config = self._load_config()
        pv_entity_id = config["sensorMappings"]["photovoltaic_powerflow_pv"]
        calculated_dates = self._calculate_dates(datetime.now())
        end_timestamp: datetime.datetime = calculated_dates["end_timestamp"]
        start_timestamp: datetime.datetime = calculated_dates["start_timestamp"]

        pv_history = self.homeassistant_adapter.load_entity_history(pv_entity_id, start_timestamp, end_timestamp)
        return self.shyft_adapter.send_pv_history(pv_history)

    def sync_all_sensors(self):
        sensorValues = []
        data = self._load_config()
        for key, value in LIST_OF_SENSORS.items():
            valueForSensor = self._load_sensor_value(key, value, data)
            if valueForSensor != "":
                sensorValues.append(json.dumps(valueForSensor))
        if len(sensorValues) > 0:
            sensorList = ",".join(sensorValues)
            payload = f"{{\"sensor_list\" : [{sensorList}]}}"
            return self.shyft_adapter.send_sensor_values(payload)

    def _load_sensor_value(self, key, bubbleSensorIdentifier, data):
        sensorId = data["sensorMappings"][key]
        try:
            sensorValue = self.homeassistant_adapter.load_entity_state(sensorId)
            return {
                "entity_id": sensorId,
                "state": sensorValue.state,
                "unit": sensorValue.unit,
                "sensor": bubbleSensorIdentifier
            }
        except:
            return ""

    def _load_config(self):
        with open(self.config_path, "r", encoding="utf-8") as file:
            return json.load(file)

    def _calculate_dates(self, now):
        end_timestamp: datetime.datetime = now
        start_timestamp: datetime.datetime = datetime(end_timestamp.year, end_timestamp.month, end_timestamp.day, 4)
        if (end_timestamp.hour <= 4):
            day_before_endtimestamp : datetime.datetime = end_timestamp - timedelta(days=1)
            start_timestamp = datetime(day_before_endtimestamp.year, day_before_endtimestamp.month, day_before_endtimestamp.day, 4)
        return {"end_timestamp": end_timestamp, "start_timestamp": start_timestamp}
