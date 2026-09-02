from homeassistant_adapter import HomeAssistantAdapter
from shyft_adapter import ShyftAdapter
from constants import CONFIG_PATH

import json
import math
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

# The unit shyft-power expects for each sensor (see the "(in kW)" etc. hints in each sensor's
# tooltip in www/app.js's helpinformation) - sensors without a numeric unit (modes, on/off) are
# intentionally absent here and pass through unconverted.
EXPECTED_UNITS = {
    "photovoltaic_powerflow_pv": "kW",
    "photovoltaic_powerflow_load": "kW",
    "photovoltaic_powerflow_grid": "kW",
    "photovoltaic_powerflow_battery": "kW",
    "battery_state_of_charge": "%",
    "battery_charge_limit_current": "kW",
    "battery_discharge_limit_current": "kW",
    "heatpump_dhw_tank_temp": "°C",
    "heatpump_heating_target_temp_normal": "°C",
    "heatpump_current_power_elect": "kW",
    "heatpump_supply_temp_hp": "°C",
    "heatpump_temp_indoor_measured": "°C",
    "electronicvehicle_state_of_charge": "%",
    "wallbox_current_charging_power": "kW",
}

# Known (from_unit, to_unit) conversions - extend as new mismatches turn up.
UNIT_CONVERSIONS = {
    ("W", "kW"): lambda value: value / 1000,
    ("Wh", "kWh"): lambda value: value / 1000,
}


def convert_to_expected_unit(key, state, unit):
    "Converts state to the unit shyft-power expects for this sensor (EXPECTED_UNITS), if Home Assistant reports a different, known-convertible unit. Passes through unchanged otherwise."
    expected_unit = EXPECTED_UNITS.get(key)
    if not expected_unit or not unit or unit == expected_unit:
        return state, unit
    convert = UNIT_CONVERSIONS.get((unit, expected_unit))
    if not convert:
        return state, unit
    try:
        return convert(float(state)), expected_unit
    except (TypeError, ValueError):
        return state, unit

# ============================================================================
# Demo-Geraete: synthetische Sensorwerte fuer die Sections, die auf der Konfigurationsseite ein
# Demo-Geraet anbieten (integrationMappings[section] == ["demo"], siehe DEMO_INTEGRATION_ID/
# DEMO_CAPABLE_SECTIONS in app.py, buildIntegrationPicker in www/app.js) - damit Dashboard,
# Energiefluss-Widget und die an shyft-power gesendeten Live-Werte schon vor der ersten echten
# Geraete-Konfiguration etwas Plausibles zeigen, statt leer zu bleiben. "Sonstiger Verbraucher" und
# "Raumtemperatur" haben bewusst kein Demo-Geraet (Letztere hat schon einen eigenen
# Auto-Simulations-Fallback ohne Sensor).
# ============================================================================

DEMO_SECTION_SENSORS = {
    "wechselrichter": ["photovoltaic_powerflow_pv", "photovoltaic_powerflow_load", "photovoltaic_powerflow_grid", "photovoltaic_powerflow_battery"],
    "batterie": ["battery_storage_command_mode", "battery_state_of_charge", "battery_charge_limit_current", "battery_discharge_limit_current"],
    "waermepumpe": ["heatpump_dhw_tank_temp", "heatpump_dhw_activated", "heatpump_dhw_on_off", "heatpump_heating_target_temp_normal", "heatpump_heating_activated", "heatpump_current_power_elect", "heatpump_on_off", "heatpump_supply_temp_hp"],
    "auto": ["electronicvehicle_state_of_charge"],
    "wallbox": ["wallbox_current_charging_power", "wallbox_plugged"],
}

SENSOR_KEY_TO_DEMO_SECTION = {
    sensor_key: section_key
    for section_key, sensor_keys in DEMO_SECTION_SENSORS.items()
    for sensor_key in sensor_keys
}


def is_demo_section(config, section_key):
    'True, wenn integrationMappings[section_key] auf das synthetische Demo-Geraet zeigt (["demo"], siehe DEMO_INTEGRATION_ID in app.py).'
    return config.get("integrationMappings", {}).get(section_key) == ["demo"]


def is_demo_sensor(config, sensor_key):
    "True, wenn sensor_key zu einer Section gehoert, die gerade im Demo-Modus ist."
    section_key = SENSOR_KEY_TO_DEMO_SECTION.get(sensor_key)
    return section_key is not None and is_demo_section(config, section_key)


def _demo_pv_kw(hour_of_day):
    "Grobe Tageslichtkurve statt eines fixen Werts, damit die PV-Leistung im Demo-Modus wenigstens ansatzweise plausibel wirkt: 0 vor 6/nach 20 Uhr, Sinus-Buckel mit Spitze ~3.5 kW um die Mittagszeit."
    if hour_of_day < 6 or hour_of_day > 20:
        return 0.0
    return max(0.0, 3.5 * math.sin((hour_of_day - 6) / 14 * math.pi))


def get_demo_value(sensor_key):
    """Liefert (state, unit) fuer einen Demo-Sensorwert, im selben Format wie ein echter HA-Sensor
    (state als String) - PV/Netz folgen grob der Tageszeit, der Rest sind plausible, weitgehend
    statische Werte. Unit None fuer Werte ohne numerische Einheit (Modi, on/off)."""
    now = datetime.now()
    hour_of_day = now.hour + now.minute / 60
    pv_kw = _demo_pv_kw(hour_of_day)
    demo_household_load_kw = 0.6

    if sensor_key == "photovoltaic_powerflow_pv":
        return f"{pv_kw:.2f}", "kW"
    if sensor_key == "photovoltaic_powerflow_load":
        return f"{demo_household_load_kw:.2f}", "kW"
    if sensor_key == "photovoltaic_powerflow_grid":
        # negativ = Einspeisung (PV-Ueberschuss), positiv = Bezug - wie bei einem echten Netz-Sensor
        return f"{demo_household_load_kw - pv_kw:.2f}", "kW"
    if sensor_key == "photovoltaic_powerflow_battery":
        return "0.00", "kW"
    if sensor_key == "battery_storage_command_mode":
        return "Maximize Self Consumption", None
    if sensor_key == "battery_state_of_charge":
        return "65", "%"
    if sensor_key == "battery_charge_limit_current":
        return "5.0", "kW"
    if sensor_key == "battery_discharge_limit_current":
        return "5.0", "kW"
    if sensor_key == "heatpump_dhw_tank_temp":
        return "52.0", "°C"
    if sensor_key == "heatpump_dhw_activated":
        return "on", None
    if sensor_key == "heatpump_dhw_on_off":
        return "off", None
    if sensor_key == "heatpump_heating_target_temp_normal":
        return "21", "°C"
    if sensor_key == "heatpump_heating_activated":
        return "on", None
    if sensor_key == "heatpump_current_power_elect":
        return "0.9", "kW"
    if sensor_key == "heatpump_on_off":
        return "on", None
    if sensor_key == "heatpump_supply_temp_hp":
        return "35.0", "°C"
    if sensor_key == "electronicvehicle_state_of_charge":
        return "60", "%"
    if sensor_key == "wallbox_current_charging_power":
        return "0.0", "kW"
    if sensor_key == "wallbox_plugged":
        return "disconnected", None
    return None, None


# Bubble's EvBatterySize Option Set only has these discrete steps (see EvBatterySize.java in the
# shyft repo) - carBatteryCapacityKwh is a free-form number, so it gets snapped to the nearest one.
EV_BATTERY_SIZE_OPTIONS_KWH = [10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100]


def snap_to_nearest_ev_battery_option(capacity_kwh):
    "Rounds a raw EV battery capacity (kWh) to the nearest Bubble EvBatterySize option text (e.g. 62 -> '60 kWh')."
    nearest = min(EV_BATTERY_SIZE_OPTIONS_KWH, key=lambda v: abs(v - float(capacity_kwh)))
    return f"{nearest} kWh"


# Lebt hier (statt in app.py, wo es urspruenglich stand) statt umgekehrt zu importieren, damit
# collect_static_config es fuers addon_sensor_data_JSON ("WB - Max Charging Power") mitschicken
# kann, ohne einen Zirkelimport zu app.py zu erzeugen (app.py importiert bereits aus sync_service.py,
# nicht umgekehrt) - app.py importiert diese Funktion jetzt von hier fuer die
# PV-Ueberschussladen-Rueckfalllogik (siehe compute_wallbox_max_kw-Aufrufe dort).
CHARGING_PHASE_VOLTAGE = 230
WALLBOX_MAX_PHASES_DEFAULT = 3
WALLBOX_MAX_CURRENT_AMPS_DEFAULT = 16


def compute_wallbox_max_kw(config):
    """Maximale Ladeleistung der Wallbox (kW), aus den vom Nutzer hinterlegten Wallbox-Eckdaten
    ("Max. Anzahl an Phasen", "Max. Stromstärke (pro Phase)"). Doppelt verwendet: (1) als Obergrenze
    fuer jeden an die Wallbox gesendeten Ziel-kW-Wert in der PV-Ueberschussladen-Rueckfalllogik
    (siehe _run_pv_surplus_charging_tick_impl in app.py) - ohne dieses Cap kann die additive Logik
    dort unbegrenzt weiter aufaddieren und Werte weit jenseits dessen anfordern, was die Wallbox
    ueberhaupt zulaesst (beobachtet: ein Regelkreis, der bis 180A/41kW hochlief und von Easee
    durchgehend mit 400 Bad Request abgelehnt wurde, da das Stromkreislimit dort bei 40A lag); (2)
    als "WB - Max Charging Power" im addon_sensor_data_JSON (siehe collect_static_config), das
    shyft-power serverseitig als ev_charge_rate fuer die Optimierung verwendet."""
    phases = config.get("wallboxMaxPhases") or WALLBOX_MAX_PHASES_DEFAULT
    amps = config.get("wallboxMaxCurrentAmps") or WALLBOX_MAX_CURRENT_AMPS_DEFAULT
    return phases * amps * CHARGING_PHASE_VOLTAGE / 1000


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

    def collect_static_config(self, optimizer_periods_override=None):
        """Builds {Bubble field name: value} from the addon's own config fields (see www/app.js's
        buildHpXyzField/buildBatteryXyz/buildElectricityXyz/... for where each is entered) - the
        staticConfig half of the addon_sensor_data_JSON payload. optimizer_periods_override
        overrides the persisted "Optimization Periods Site" value (without touching the config file
        itself) - used for the reduced-period retry after an optimizer timeout, see
        _handle_optimizer_timeout in app.py."""
        data = self._load_config()
        static_config = {}

        def add(bubble_name, config_key):
            value = data.get(config_key)
            if value is not None and value != "":
                static_config[bubble_name] = value

        add("HP - Type", "hpType")
        add("HP - Building Size", "hpBuildingSize")
        add("HP - Energy Efficiency Building", "hpEnergyEfficiency")
        add("HP - DHW Tank Size", "hpDhwTankSize")
        add("HP - Max. Power", "hpMaxPower")
        add("HP - Max Supply Temp", "hpMaxSupplyTempC")
        add("HP - Heating Target Temp (min)", "hpHeatingTargetTempMin")
        add("HP - Heating Buffer", "hpHeatingBuffer")
        add("HP - Heating Curve, level", "hpHeatingCurveLevel")
        add("HP - Heating Curve, slope", "hpHeatingCurveSlope")
        add("B - Capacity", "batteryCapacityKwh")
        add("B - SOC min", "batterySocMinPercent")
        add("EV - SOC Normal", "evSocNormal")
        add("EV - SOC Max PV Surplus", "evSocMaxPvSurplus")
        add("CO - Price Gas", "coPriceGas")
        if optimizer_periods_override is not None:
            static_config["Optimization Periods Site"] = optimizer_periods_override
        else:
            add("Optimization Periods Site", "optimizationPeriodsSite")
        add("Electricity Base Load (kWh, year)", "electricityBaseLoad")
        add("Electricity Price Buy", "electricityPriceBuy")
        add("Electricity Price Sell", "electricityPriceSell")

        # EV - Battery Size (kWh) is asked as a plain number (carBatteryCapacityKwh, also used
        # locally for the range display) rather than a second redundant dropdown - snapped here to
        # the nearest Bubble EvBatterySize option text.
        ev_capacity = data.get("carBatteryCapacityKwh")
        if ev_capacity:
            static_config["EV - Battery Size (kWh)"] = snap_to_nearest_ev_battery_option(ev_capacity)

        # Nur wenn ueberhaupt eine Wallbox ausgewaehlt ist - wallboxMaxPhases/wallboxMaxCurrentAmps
        # haben sonst trotzdem einen (dann bedeutungslosen) Default-Wert.
        if data.get("integrationMappings", {}).get("wallbox"):
            static_config["WB - Max Charging Power"] = round(compute_wallbox_max_kw(data), 3)

        return static_config

    def collect_live_values(self):
        "Builds {Bubble field name: value} for every sensor with a currently readable value - the liveValues half of the addon_sensor_data_JSON payload sent via update_site_addon (replaces the old sync_all_sensors/addon_sensor_data sensor_list workflow)."
        live_values = {}
        data = self._load_config()
        for key, bubble_name in LIST_OF_SENSORS.items():
            entry = self._load_sensor_value(key, bubble_name, data)
            if entry != "":
                live_values[entry["sensor"]] = entry["state"]
        return live_values

    def _load_sensor_value(self, key, bubbleSensorIdentifier, data):
        if is_demo_sensor(data, key):
            state, unit = get_demo_value(key)
            if state is None:
                return ""
            return {
                "entity_id": None,
                "state": state,
                "unit": unit,
                "sensor": bubbleSensorIdentifier
            }
        sensorId = data["sensorMappings"][key]
        try:
            sensorValue = self.homeassistant_adapter.load_entity_state(sensorId)
            state, unit = convert_to_expected_unit(key, sensorValue.state, sensorValue.unit)
            return {
                "entity_id": sensorId,
                "state": state,
                "unit": unit,
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
