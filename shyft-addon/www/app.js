const outsideHomeAssistant = "http://localhost:8000/0";
const insideHomeAssistant = window.location.pathname;
const configUri = insideHomeAssistant + "/config";
const sensorIdsUri = insideHomeAssistant + "/sensorids";
const integrationsUri = insideHomeAssistant + "/integrations";
const shyftActionsUri = insideHomeAssistant + "/shyft/actions";
const notificationTargetsUri = insideHomeAssistant + "/notification-targets";
const servicesUri = insideHomeAssistant + "/services";
let configData = {}
let integrationsData = {integrations: [], entityMap: {}};
let allSensorIdOptions = [];
let allServiceOptions = [];
let notificationTargetOptions = [];

const helpinformation = {
    'photovoltaic_powerflow_load': {
        label: 'Aktueller Strom - Haushalt',
        description: ' Die Leistung (in kW), die dein Haushalt aktuell verbraucht.'
    },
    'photovoltaic_powerflow_pv': {
        label: 'Aktueller Strom - PV',
        description: ' Die aktuelle Leistung (in kW) deiner PV-Anlage.'
    },
    'photovoltaic_powerflow_grid': {
        label: 'Aktueller Strom - Netz',
        description: ' Die aktuelle Leistung (in kW), die dein Haushalt aus dem öffentlichen Stromnetz bezieht bzw. dorthin einspeist.'
    },
    'photovoltaic_powerflow_battery': {
        label: 'Aktueller Strom - Batterie',
        description: ' Die aktuelle Leistung (in kW), mit dem deine Batterie geladen (positiver Wert) oder entladen (negativer Wert) wird.'
    },
    'battery_state_of_charge': {
        label: 'Ladestand',
        description: ' Aktueller Ladestand deiner Batterie in Prozent.'
    },
    'battery_storage_command_mode': {
        label: 'Batterie: Steuerungsmodus',
        'description': ' Der Modus, in den deine Batterie versetzt werden kann (z.B. Eigenverbrauchsoptimierung, Netzladen)'
    },
    'battery_charge_limit_current': {
        label: 'Batterie: Aktuelle max. Ladeleistung',
        description: 'Leistung (in kW), die an der Batterie als aktuelle Begrenzung für die Ladeleistung eingestellt ist.'
    },
    'battery_discharge_limit_current': {
        label: 'Batterie: Aktuelle max. Entladeleistung',
        description: ' Leistung (in kW), die an der Batterie als aktuelle Begrenzung für die Entladeleistung eingestellt ist.'
    },
    'heatpump_dhw_tank_temp': {
        label: 'Temperatur Warmwassertank',
        description: ' Die aktuelle Temperatur im Warmwassertank (in °C)'
    },
    'heatpump_dhw_activated': {
        label: 'Warmwassermodus aktiviert? An/Aus',
        description: ' je nachdem ob an deiner Wärmepumpe die Warmwasserbereitung aktiviert ist oder nicht.'
    },
    'heatpump_dhw_on_off': {
        label: 'Warmwasser gerade erwärmt? An / Aus',
        description: ' je nachdem ob deine Wärmepumpe gerade Brauchwasser erwärmt oder nicht.'
    },
    'heatpump_heating_target_temp_normal': {
        label: 'Heizung Soll-Temperatur (aktuell)',
        description: ' Gewünschte Raumtemperatur (Solltemperatur). Über die stündliche Anpassung dieses Wertes steuert Shyft kurzfristig die Leistung deiner Wärmepumpe und stellt die gewünschte Solltemperatur in deinen Räumen sicher.'
    },
    'heatpump_heating_activated': {
        label: 'Heizung aktiviert?',
        description: ' Ja / Nein, je nachdem, ob du die Heizung an deiner Wärmepumpe aktiviert hast oder nicht.'
    },
    'heatpump_current_power_elect': {
        label: 'Aktuelle Leistung Wärmepumpe (elektrisch)',
        description: ' in kW'
    },
    'heatpump_on_off': {
        label: 'Wärmepumpe an/aus',
        description: ' An/Aus, je nachdem ob deine Wärmepumpe gerade läuft oder aus ist.'
    },
    'heatpump_temp_indoor_measured': {
        label: 'Innenraumtemperatur gemessen',
        description: ' Tatsächlich gemessene Innenraumtemperatur in °C. Für diesen Sensor musst du einen Temperatursensor mit Shyft verbinden.'
    },
    'heatpump_supply_temp_hp': {
        label: 'Vorlauftemperatur Wärmepumpe',
        description: 'Die Vorlauftemperatur deiner Wärmepumpe'
    },
    'electronicvehicle_state_of_charge': {
        label: 'Auto - Ladestand',
        description: ' Ladestand deines Autos (in %)'
    },
    'wallbox_current_charging_power': {
        label: 'Wallbox - Ladestrom',
        description: ' Aktueller Ladestrom (in kW)'
    },
    'wallbox_plugged': {
        label: 'Wallbox: Auto verbunden?',
        description: 'Ja / Nein, je nachdem ob der Ladestecker deiner Wallbox im Auto eingesteckt ist oder nicht.'
    },
    'photovoltaic_feed_in_limit_entity': {
        label: 'PV: Einspeisung begrenzen (aktuell)',
        description: 'Die Home-Assistant-Entity (number), über die shyft-power die Einspeiseleistung deiner PV-Anlage direkt begrenzt - keine eigene Automation nötig.'
    },
    'photovoltaic_consumption_limit_entity': {
        label: 'Verbrauch begrenzen §14a (aktuell)',
        description: 'Die Home-Assistant-Entity (number), über die shyft-power deinen Verbrauch im Rahmen von §14a EnWG direkt begrenzt - keine eigene Automation nötig.'
    },
    'sonstiger_verbraucher_switch_entity': {
        label: 'Sonstiger Verbraucher (aktuell)',
        description: 'Die Home-Assistant-Entity (switch), über die shyft-power den sonstigen Verbraucher direkt ein-/ausschaltet - keine eigene Automation nötig.'
    },

}

const actorHelpInformation = {
    'pv_feed_in_limit': {
        label: 'PV: Einspeisung begrenzen',
        description: ' Home-Assistant-Automation, die ausgelöst wird, wenn Shyft die PV-Einspeisung ins Netz begrenzen möchte.'
    },
    'consumption_limit_14a': {
        label: 'Verbrauch begrenzen (§14a)',
        description: ' Home-Assistant-Automation, die ausgelöst wird, wenn Shyft den Verbrauch im Rahmen von §14a EnWG begrenzen möchte.'
    },
    'battery_charge_shift_pv_surplus': {
        label: 'Batterie-Laden verschieben (PV-Überschuss)',
        description: ' Home-Assistant-Automation, die ausgelöst wird, wenn Shyft das Laden der Batterie aus PV-Überschuss zeitlich verschieben möchte. Der Zielwert wird als {{ target }} übergeben, "start" bzw. "stop" als {{ phase }}.'
    },
    'battery_discharge_shift': {
        label: 'Batterie-Entladen verschieben',
        description: ' Home-Assistant-Automation, die ausgelöst wird, wenn Shyft das Entladen der Batterie zeitlich verschieben möchte. Der Zielwert wird als {{ target }} übergeben, "start" bzw. "stop" als {{ phase }}.'
    },
    'battery_grid_charge': {
        label: 'Batterie netzladen',
        description: ' Home-Assistant-Automation, die ausgelöst wird, wenn Shyft die Batterie aus dem Netz laden möchte. Der Zielwert wird als {{ target }} übergeben, "start" bzw. "stop" als {{ phase }}.'
    },
    'battery_action_stop': {
        label: 'Batterie-Aktion beenden',
        description: ' Home-Assistant-Automation, die ausgelöst wird, wenn Shyft eine laufende Batterie-Aktion beenden möchte (gemeinsam für alle drei Batterie-Aktionstypen oben) - kein Zielwert nötig, {{ target }} ist hier immer leer.'
    },
    'heating_target_temp': {
        label: 'Heizung Soll-Temperatur (aktuell)',
        description: ' Home-Assistant-Automation, die ausgelöst wird, wenn Shyft die Soll-Temperatur der Heizung anpassen möchte.'
    },
    'car_charge_start': {
        label: 'Auto laden',
        description: ' Home-Assistant-Automation, die ausgelöst wird, wenn Shyft das Laden deines Autos starten möchte.'
    },
    'car_charge_stop': {
        label: 'Auto laden beenden',
        description: ' Home-Assistant-Automation, die ausgelöst wird, wenn Shyft das Laden deines Autos beenden möchte.'
    },
    'consumer_on': {
        label: 'Verbraucher an',
        description: ' Home-Assistant-Automation, die ausgelöst wird, wenn Shyft den sonstigen Verbraucher einschalten möchte.'
    },
    'consumer_off': {
        label: 'Verbraucher aus',
        description: ' Home-Assistant-Automation, die ausgelöst wird, wenn Shyft den sonstigen Verbraucher ausschalten möchte.'
    },
}

// Restricts entity suggestions per sensor field. 'none' = no restriction.
// When an entity's state is unavailable/unknown we can't reliably check its
// device_class/state, so it is allowed through rather than hidden.
const SENSOR_ENTITY_FILTERS = {
    'photovoltaic_powerflow_pv': {type: 'device_class', value: 'power'},
    'photovoltaic_powerflow_load': {type: 'device_class', value: 'power'},
    'photovoltaic_powerflow_grid': {type: 'device_class', value: 'power'},
    'photovoltaic_powerflow_battery': {type: 'device_class', value: 'power'},
    'battery_storage_command_mode': {type: 'none'},
    'battery_state_of_charge': {type: 'device_class', value: 'battery'},
    'battery_charge_limit_current': {type: 'device_class', value: 'power'},
    'battery_discharge_limit_current': {type: 'device_class', value: 'power'},
    'heatpump_dhw_tank_temp': {type: 'device_class', value: 'temperature'},
    'heatpump_dhw_activated': {type: 'state_on_off'},
    'heatpump_dhw_on_off': {type: 'state_on_off'},
    'heatpump_heating_target_temp_normal': {type: 'device_class', value: 'temperature'},
    'heatpump_heating_activated': {type: 'state_on_off'},
    'heatpump_current_power_elect': {type: 'device_class', value: 'power'},
    'heatpump_on_off': {type: 'state_on_off'},
    'heatpump_supply_temp_hp': {type: 'device_class', value: 'temperature'},
    'heatpump_temp_indoor_measured': {type: 'device_class', value: 'temperature'},
    'electronicvehicle_state_of_charge': {type: 'device_class', value: 'battery'},
    'wallbox_current_charging_power': {type: 'device_class', value: 'power'},
    'wallbox_plugged': {type: 'exclude_units', values: ['kWh', 'kW', 'W', 'A', 'V', '°C', '%', 'Wh']},
    'photovoltaic_feed_in_limit_entity': {type: 'none'},
    'photovoltaic_consumption_limit_entity': {type: 'none'},
    'sonstiger_verbraucher_switch_entity': {type: 'state_on_off'},
}

const INTEGRATION_SECTIONS = [
    {
        key: 'wechselrichter',
        label: 'Wechselrichter',
        sensors: ['photovoltaic_powerflow_pv', 'photovoltaic_powerflow_load', 'photovoltaic_powerflow_grid', 'photovoltaic_powerflow_battery', 'photovoltaic_feed_in_limit_entity', 'photovoltaic_consumption_limit_entity'],
        actions: ['pv_feed_in_limit', 'consumption_limit_14a'],
        requiresDeviceClass: 'power'
    },
    {
        key: 'batterie',
        label: 'Batterie',
        sensors: ['battery_storage_command_mode', 'battery_state_of_charge', 'battery_charge_limit_current', 'battery_discharge_limit_current'],
        actions: ['battery_charge_shift_pv_surplus', 'battery_discharge_shift', 'battery_grid_charge', 'battery_action_stop'],
        requiresDeviceClass: 'power'
    },
    {
        key: 'waermepumpe',
        label: 'Wärmepumpe',
        sensors: ['heatpump_dhw_tank_temp', 'heatpump_dhw_activated', 'heatpump_dhw_on_off', 'heatpump_heating_target_temp_normal', 'heatpump_heating_activated', 'heatpump_current_power_elect', 'heatpump_on_off', 'heatpump_supply_temp_hp'],
        actions: ['hot_water', 'heating_target_temp'],
        requiresDeviceClass: 'temperature'
    },
    {
        key: 'auto',
        label: 'Auto',
        sensors: ['electronicvehicle_state_of_charge'],
        actions: []
    },
    {
        key: 'wallbox',
        label: 'Wallbox',
        sensors: ['wallbox_current_charging_power', 'wallbox_plugged'],
        actions: ['car_charge_start', 'car_charge_stop']
    },
    {
        key: 'raumtemperatur',
        label: 'Raumtemperatur',
        sensors: ['heatpump_temp_indoor_measured'],
        actions: [],
        description: 'Hinterlege einen Innenraum-Temperatursensor. Shyft stellt dann sicher, dass deine Räume nie zu kalt werden. Die Vorlauftemperatur deiner Wärmepumpe kann dann ohne Reserven gesteuert werden und so Kosten sparen. Hinterlegst du keinen Sensor, simulieren wir die Raumtemperatur.\nTipp: Wenn du das Minimum mehrerer Temperatursensoren verwenden willst, erstelle in Home Assistant einen entsprechenden Hilfssensor.'
    },
    {
        key: 'sonstiger_verbraucher',
        label: 'Sonstiger Verbraucher',
        sensors: ['sonstiger_verbraucher_switch_entity'],
        actions: ['consumer_on', 'consumer_off']
    },
]

async function getJson(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const result = await response.json();

    return result;
}

async function putJson(url, data) {
    const response = await fetch(url, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
}

async function postJson(url, data) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
}


const VALUE_POSTFIX = "_value";
const ACTOR_VALUE_POSTFIX = "_actor_value";
const ACTION_TOGGLE_POSTFIX = "_toggle";

// Actions the addon sets up and calls itself (via a generated script), rather than
// asking the user to paste an automation/script entity id.
// Actions the addon controls directly (writes the entity itself), no user-side automation needed -
// mirrors the Home Assistant entity domains handled in AUTO_MANAGED_CONTROLS in app.py.
const AUTO_MANAGED_CONTROLS = [
    {key: 'heating_target_temp', type: 'number', sensorField: 'heatpump_heating_target_temp_normal', actionKeys: ['heating_target_temp'], titleLabel: 'Heizung Soll-Temperatur (aktuell)', unit: '°C', step: 1},
    {key: 'pv_feed_in_limit', type: 'number', sensorField: 'photovoltaic_feed_in_limit_entity', actionKeys: ['pv_feed_in_limit'], titleLabel: 'PV: Einspeisung begrenzen (aktuell)', unit: '', step: 1, hasAutomationVariant: true},
    {key: 'consumption_limit_14a', type: 'number', sensorField: 'photovoltaic_consumption_limit_entity', actionKeys: ['consumption_limit_14a'], titleLabel: 'Verbrauch begrenzen §14a (aktuell)', unit: '', step: 1, hasAutomationVariant: true},
    {key: 'consumer_on_off', type: 'switch', sensorField: 'sonstiger_verbraucher_switch_entity', actionKeys: ['consumer_on', 'consumer_off'], titleLabel: 'Sonstiger Verbraucher (aktuell)', hasAutomationVariant: true},
];
const AUTO_MANAGED_ACTION_KEYS = new Set(AUTO_MANAGED_CONTROLS.flatMap(c => c.actionKeys));

// "Auto laden" gets its own bespoke recipe UI (buildCarChargeControl) instead of the uniform
// AUTO_MANAGED_CONTROLS shape, since it's a multi-stage, manufacturer-varying command sequence.
const CAR_CHARGE_ACTION_KEYS = new Set(['car_charge_start', 'car_charge_stop']);

// "Warmwasser" also gets a device+service picker (buildHotWaterControl) rather than the
// "map an existing Home-Assistant automation" approach every other manual action still uses -
// unlike those, it's a single fixed action (no branches, no computed value, no Ende-Verhalten).
const HOT_WATER_ACTION_KEYS = new Set(['hot_water']);

// The branches each "Auto laden" recipe stage splits its enum fields into (see
// buildBranchedStageFields) - phaseCount by computed phase count, control by start vs. stop.
// amperage has no branches: its Ampere value is always the same computed number regardless of
// outcome, so it gets one or more auto-filled fields instead (see amountFields).
const CAR_CHARGE_STAGE_BRANCHES = {
    phaseCount: {keys: ['1', '3'], labels: ['Mit 1 Phase laden', 'Mit 3 Phasen laden']},
    amperage: {keys: [], labels: [], amountUnit: 'A'},
    control: {keys: ['start', 'stop'], labels: ['Ladevorgang starten', 'Ladevorgang beenden']},
};

// actorMappings keys that get an on/off "nur simulieren" toggle. battery_action_stop/car_charge_stop
// are shared stop-actors for an already-toggled type and don't get their own toggle.
const ACTION_TYPE_TOGGLE_KEYS = new Set([
    'pv_feed_in_limit', 'consumption_limit_14a', 'battery_charge_shift_pv_surplus',
    'battery_discharge_shift', 'battery_grid_charge', 'hot_water', 'car_charge_start', 'consumer_on'
]);

const NOTIFICATION_TYPES = {
    'action_start_end': 'Aktionen starten / beenden',
    'device_status_deviation': 'Geräteverhalten abweichend von Shyft-Steuerung'
};

// Which device section (see INTEGRATION_SECTIONS) each shyft-power "Action Name" belongs to -
// used only to look up that section's selected integration for its brand icon (getActionIconUrl).
const ACTION_NAME_TO_SECTION_KEY = {
    'PV: Einspeisung begrenzen': 'wechselrichter',
    'Verbrauch begrenzen (§14a)': 'wechselrichter',
    'Batterie-Laden verschieben (PV-Überschuss)': 'batterie',
    'Batterie-Entladen verschieben': 'batterie',
    'Batterie netzladen': 'batterie',
    'Warmwasser': 'waermepumpe',
    'Heizung Soll-Temperatur': 'waermepumpe',
    'Auto laden': 'wallbox',
    'Verbraucher an': 'sonstiger_verbraucher',
};

// Home Assistant's public, unauthenticated brand-icon CDN - the same one HA's own frontend uses
// for integration logos in Settings -> Devices & Services, no call to the user's instance needed.
function getActionIconUrl(actionName) {
    const sectionKey = ACTION_NAME_TO_SECTION_KEY[actionName];
    if (!sectionKey) return null;
    const selectedIds = currentIntegrationSelections[sectionKey] || [];
    if (selectedIds.length === 0) return null;
    const integration = integrationsData.integrations.find(i => i.id === selectedIds[0]);
    if (!integration) return null;
    const match = integration.name.match(/\(([^)]+)\)$/);
    if (!match) return null;
    return `https://brands.home-assistant.io/_/${match[1]}/icon.png`;
}

let currentIntegrationSelections = {};

// Reads one recipe stage's service + field values back out of the DOM (see
// buildBranchedStageFields for how they're rendered) - shared by "Auto laden"'s per-stage loop and
// the single-stage "Warmwasserbereitung" recipe, since both are built from the same picker.
// previousSharedFields carries forward whatever was already saved for a field that's no longer
// rendered (see the isNumber branch below), so it isn't silently wiped out on the next save.
function readStageFromDom(idPrefix, stageKey, integrationKey, amountUnit, branchKeys, previousSharedFields) {
    const serviceElement = document.getElementById(idPrefix + stageKey + '_service');
    if (!serviceElement) return null;
    const stage = {service: serviceElement.value, sharedFields: {}, branchFields: {}, amountFields: []};
    const match = allServiceOptions.find(s => s.service === serviceElement.value);
    if (match) {
        for (const field of match.fields) {
            if (field.options.length === 0) {
                if (field.isDevice) {
                    // never shown in the UI - always the already-selected integration's own device
                    const devices = getIntegrationDevices(integrationKey);
                    if (devices.length > 0) stage.sharedFields[field.name] = devices[0].id;
                    continue;
                }
                if (amountUnit && field.isNumber) {
                    if (field.unit === amountUnit) {
                        // reliably picked out via its declared unit (e.g. "A") rather than
                        // guessed - never shown in the UI, always gets the computed value at
                        // call time
                        stage.amountFields.push(field.name);
                    } else if (previousSharedFields && previousSharedFields[field.name] !== undefined) {
                        // a stage that cares about an amount field (e.g. the amperage stage) also
                        // hides any OTHER number field it has (e.g. Easee's time_to_live) - it's
                        // config-once data, not something worth re-showing an input for every
                        // time, so just keep whatever was already configured
                        stage.sharedFields[field.name] = previousSharedFields[field.name];
                    }
                    continue;
                }
                const el = document.getElementById(idPrefix + stageKey + '_field_' + field.name);
                if (el) stage.sharedFields[field.name] = el.value;
            } else {
                for (const branchKey of branchKeys) {
                    const el = document.getElementById(idPrefix + stageKey + '_branch_' + branchKey + '_field_' + field.name);
                    if (el) {
                        stage.branchFields[branchKey] = stage.branchFields[branchKey] || {};
                        stage.branchFields[branchKey][field.name] = el.value;
                    }
                }
            }
        }
    }
    return stage;
}

async function saveConfigurationNow() {
    const sensorValues = {...(configData["sensorMappings"] || {})};
    const actorValues = {...(configData["actorMappings"] || {})};
    const integrationValues = {};
    const actionTypeEnabled = {...(configData["actionTypeEnabled"] || {})};

    for (const section of INTEGRATION_SECTIONS) {
        integrationValues[section.key] = currentIntegrationSelections[section.key] || [];

        for (const key of section.sensors) {
            const element = document.getElementById(key + VALUE_POSTFIX);
            if (element) {
                sensorValues[key] = element.value;
            }
        }
        for (const key of section.actions) {
            const element = document.getElementById(key + ACTOR_VALUE_POSTFIX);
            if (element) {
                actorValues[key] = element.value;
            }
            const toggleElement = document.getElementById(key + ACTION_TOGGLE_POSTFIX);
            if (toggleElement) {
                actionTypeEnabled[key] = toggleElement.checked;
            }
        }
    }
    const controlVariant = {...(configData["controlVariant"] || {})};
    for (const control of AUTO_MANAGED_CONTROLS) {
        const toggleKey = control.actionKeys[0];
        const toggleElement = document.getElementById(toggleKey + ACTION_TOGGLE_POSTFIX);
        if (toggleElement) {
            actionTypeEnabled[toggleKey] = toggleElement.checked;
        }
        if (!control.hasAutomationVariant) continue;
        const variantElement = document.getElementById(control.key + '_variant');
        if (variantElement) {
            controlVariant[control.key] = variantElement.value;
        }
        if (control.type === 'number') {
            const automationElement = document.getElementById(control.key + '_ha_automation_entity');
            if (automationElement) {
                actorValues[control.key] = automationElement.value;
            }
        } else {
            const onElement = document.getElementById('consumer_on_ha_automation_entity');
            if (onElement) actorValues['consumer_on'] = onElement.value;
            const offElement = document.getElementById('consumer_off_ha_automation_entity');
            if (offElement) actorValues['consumer_off'] = offElement.value;
        }
    }

    const notificationTargets = {...(configData["notificationTargets"] || {})};
    const phoneInput = document.getElementById('notificationPhone');
    if (phoneInput) {
        notificationTargets['phone'] = phoneInput.value;
    }
    const notificationsEnabled = {...(configData["notificationsEnabled"] || {})};
    for (const key of Object.keys(NOTIFICATION_TYPES)) {
        const toggleElement = document.getElementById('notification_' + key + ACTION_TOGGLE_POSTFIX);
        if (toggleElement) {
            notificationsEnabled[key] = toggleElement.checked;
        }
    }

    const carChargeRecipe = {...(configData["carChargeRecipe"] || {})};
    const recipeTypeElement = document.getElementById('car_charge_recipe_type');
    if (recipeTypeElement) {
        carChargeRecipe.type = recipeTypeElement.value;
    }
    const haAutomationEntityElement = document.getElementById('car_charge_ha_automation_entity');
    if (haAutomationEntityElement) {
        carChargeRecipe.haAutomationEntityId = haAutomationEntityElement.value;
    }
    for (const stageKey of Object.keys(CAR_CHARGE_STAGE_BRANCHES)) {
        const branch = CAR_CHARGE_STAGE_BRANCHES[stageKey];
        const stage = readStageFromDom('car_charge_', stageKey, 'wallbox', branch.amountUnit, branch.keys, (carChargeRecipe[stageKey] || {}).sharedFields);
        if (stage) carChargeRecipe[stageKey] = stage;
    }

    const hotWaterStage = readStageFromDom('hot_water_', 'hotWater', 'waermepumpe', undefined, [], (configData["hotWaterRecipe"] || {}).sharedFields);
    const hotWaterRecipe = hotWaterStage || (configData["hotWaterRecipe"] || {});
    const hotWaterVariantElement = document.getElementById('hot_water_variant');
    if (hotWaterVariantElement) {
        hotWaterRecipe.type = hotWaterVariantElement.value;
    }
    const hotWaterAutomationElement = document.getElementById('hot_water_ha_automation_entity');
    if (hotWaterAutomationElement) {
        hotWaterRecipe.haAutomationEntityId = hotWaterAutomationElement.value;
    }

    const toBeWritten = {
        "sensorMappings": sensorValues,
        "actorMappings": actorValues,
        "integrationMappings": integrationValues,
        "actionTypeEnabled": actionTypeEnabled,
        "controlVariant": controlVariant,
        "carChargeRecipe": carChargeRecipe,
        "hotWaterRecipe": hotWaterRecipe,
        "notificationTargets": notificationTargets,
        "notificationsEnabled": notificationsEnabled,
        "wallboxConnectionStatusMapping": configData["wallboxConnectionStatusMapping"] || {},
        "carBatteryCapacityKwh": configData["carBatteryCapacityKwh"] ?? null,
        "carConsumptionKwhPer100km": configData["carConsumptionKwhPer100km"] ?? null,
        "batteryFlowSignOverride": configData["batteryFlowSignOverride"] ?? null
    };
    const response = await putJson(configUri, toBeWritten);
    configData = response;
    for (const control of document.querySelectorAll('.autoActionControl')) {
        if (control.__refresh) {
            control.__refresh();
        }
    }
}

let saveStatusTimeout = null;

// Sammelstelle fuer Konfigurations-Warnhinweise ("muss behoben werden, bevor Shyft
// funktioniert") oben auf der Konfigurationsseite - aktuell nur die unvollstaendige
// Wallbox-Status-Zuordnung, siehe compute_config_warnings in app.py fuer den Ausbau.
async function renderConfigWarnings() {
    const container = document.getElementById('configWarnings');
    if (!container) return;
    let warnings = [];
    try {
        const result = await getJson(insideHomeAssistant + '/config/warnings');
        warnings = result.warnings || [];
    } catch (err) {
        console.log(err);
        return;
    }
    container.innerHTML = '';
    for (const warning of warnings) {
        const item = document.createElement('div');
        item.className = 'configWarningItem';
        item.textContent = '⚠ ' + warning.message;
        container.appendChild(item);
    }
}

async function autoSave() {
    const statusElement = document.getElementById('saveStatus');
    try {
        if (statusElement) {
            statusElement.classList.remove('status-saved', 'status-error');
            statusElement.textContent = 'Speichere...';
        }
        await saveConfigurationNow();
        renderConfigWarnings();
        if (statusElement) {
            statusElement.classList.remove('status-error');
            statusElement.classList.add('status-saved');
            statusElement.textContent = 'Gespeichert';
            clearTimeout(saveStatusTimeout);
            saveStatusTimeout = setTimeout(() => {
                statusElement.textContent = '';
                statusElement.classList.remove('status-saved');
            }, 2000);
        }
    } catch (err) {
        console.log(err);
        if (statusElement) {
            statusElement.classList.remove('status-saved');
            statusElement.classList.add('status-error');
            statusElement.textContent = 'Fehler beim Speichern';
        }
    }
}

const loadConfiguration = async (event) => {
    try {
        console.log("loadConfiguration called");
        configData = await getJson(configUri);
        allSensorIdOptions = await getJson(sensorIdsUri);
        integrationsData = await getJson(integrationsUri);
        try {
            notificationTargetOptions = await getJson(notificationTargetsUri);
        } catch (err) {
            console.log(err);
            notificationTargetOptions = [];
        }
        try {
            allServiceOptions = await getJson(servicesUri);
        } catch (err) {
            console.log(err);
            allServiceOptions = [];
        }

        const allEntityOptionsElement = document.getElementById('allEntityOptions');
        for (const entity of allSensorIdOptions) {
            const option = document.createElement("option");
            option.value = entity.label;
            allEntityOptionsElement.appendChild(option);
        }

        renderIntegrationSections();
        renderNotificationSection();
        renderConfigWarnings();
    } catch (err) {
        console.log(err);
    }
}

function isAmbiguousState(state) {
    const normalized = (state || '').toLowerCase();
    return normalized === 'unavailable' || normalized === 'unknown' || normalized === '';
}

function matchesDeviceClass(entity, deviceClass) {
    if (entity.device_class === deviceClass) return true;
    // give the benefit of the doubt only when we genuinely have no class info to check
    return isAmbiguousState(entity.state) && !entity.device_class;
}

function matchesOnOffState(entity) {
    const state = (entity.state || '').toLowerCase();
    if (state === 'on' || state === 'off') return true;
    return isAmbiguousState(entity.state);
}

function entityMatchesSensorFilter(entity, filter) {
    if (!filter || filter.type === 'none') return true;
    if (filter.type === 'device_class') return matchesDeviceClass(entity, filter.value);
    if (filter.type === 'state_on_off') return matchesOnOffState(entity);
    if (filter.type === 'exclude_units') return !filter.values.includes(entity.unit);
    if (filter.type === 'domain') return filter.values.includes(entity.entity_id.split('.')[0]);
    return true;
}

function integrationHasDeviceClass(entryId, deviceClass) {
    // strict match on purpose: the permissive "unavailable -> allow" rule in matchesDeviceClass
    // is meant for individual sensor suggestions, not for this existence check - otherwise any
    // integration with one unrelated unavailable entity would satisfy every possible requirement
    const entityIds = integrationsData.entityMap[entryId] || [];
    return allSensorIdOptions.some(entity => entityIds.includes(entity.entity_id) && entity.device_class === deviceClass);
}

let openIntegrationPicker = null;

function closeOpenIntegrationPicker() {
    if (openIntegrationPicker) {
        openIntegrationPicker.panel.hidden = true;
        openIntegrationPicker = null;
    }
}

document.addEventListener('mousedown', (event) => {
    if (openIntegrationPicker && !openIntegrationPicker.wrapper.contains(event.target)) {
        closeOpenIntegrationPicker();
    }
});

// Whether a device tile has everything filled in yet, checked from configData alone (no need to
// wait for any live status fetch) - an empty sensor/action mapping, an unconfigured auto-managed
// control, or an incomplete "Auto laden" recipe all count as incomplete. A section with no
// integration selected at all has nothing to show either way, so it's not forced open.
function isSectionComplete(section, currentIds) {
    if (currentIds.length === 0) return true;

    const sensorMappings = configData['sensorMappings'] || {};
    const actorMappings = configData['actorMappings'] || {};

    for (const key of section.sensors) {
        if (!sensorMappings[key]) return false;
    }

    for (const control of AUTO_MANAGED_CONTROLS) {
        if (!control.actionKeys.some(k => section.actions.includes(k))) continue;
        const variant = control.hasAutomationVariant ? ((configData['controlVariant'] || {})[control.key] || 'direct') : 'direct';
        if (variant === 'ha_automation') {
            if (control.type === 'number') {
                if (!actorMappings[control.key]) return false;
            } else if (!actorMappings['consumer_on'] || !actorMappings['consumer_off']) {
                return false;
            }
        } else if (!sensorMappings[control.sensorField]) {
            return false;
        }
    }

    const manualActions = section.actions.filter(key => !AUTO_MANAGED_ACTION_KEYS.has(key) && !CAR_CHARGE_ACTION_KEYS.has(key) && !HOT_WATER_ACTION_KEYS.has(key));
    for (const key of manualActions) {
        if (!actorMappings[key]) return false;
    }

    if (section.actions.some(k => CAR_CHARGE_ACTION_KEYS.has(k))) {
        const recipe = configData['carChargeRecipe'] || {};
        const amperageStage = recipe.amperage || {};
        const isThreeStageComplete = recipe.type === 'three_stage' && (recipe.phaseCount || {}).service
            && amperageStage.service && (amperageStage.amountFields || []).length > 0 && (recipe.control || {}).service;
        const isHaAutomationComplete = recipe.type === 'ha_automation' && !!recipe.haAutomationEntityId;
        if (!(isThreeStageComplete || isHaAutomationComplete)) {
            return false;
        }
    }

    if (section.actions.some(k => HOT_WATER_ACTION_KEYS.has(k))) {
        const recipe = configData['hotWaterRecipe'] || {};
        const isComplete = recipe.type === 'ha_automation' ? !!recipe.haAutomationEntityId : !!recipe.service;
        if (!isComplete) return false;
    }

    return true;
}

// Catches errors that only show up after an async status fetch resolves (e.g. an entity that's
// mapped but currently unreadable) - forces the tile open the moment one appears, even though
// the initial synchronous isSectionComplete check couldn't have known about it yet.
function watchForErrorsToExpand(bodyDiv, onError) {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.target.classList && mutation.target.classList.contains('status-error')) {
                onError();
                observer.disconnect();
                return;
            }
        }
    });
    observer.observe(bodyDiv, {attributes: true, attributeFilter: ['class'], subtree: true});
}

function renderIntegrationSections() {
    const container = document.getElementById('deviceSections');
    container.innerHTML = '';
    const integrationMappings = configData["integrationMappings"] || {};

    for (const section of INTEGRATION_SECTIONS) {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'integrationSection';

        const currentIds = integrationMappings[section.key] || [];
        currentIntegrationSelections[section.key] = currentIds;
        let expanded = !isSectionComplete(section, currentIds);

        const heading = document.createElement('div');
        heading.className = 'integrationHeading';
        const headingRow = document.createElement('div');
        headingRow.className = 'integrationHeadingRow';

        const toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.className = 'sectionToggleButton';
        toggleButton.setAttribute('aria-label', 'Ein-/ausklappen');
        toggleButton.textContent = '▾';
        headingRow.appendChild(toggleButton);

        const headingTitle = document.createElement('h2');
        headingTitle.textContent = section.label;
        headingRow.appendChild(headingTitle);
        if (section.description) {
            headingRow.appendChild(buildTooltip(section.description));
        }
        heading.appendChild(headingRow);

        const bodyDiv = document.createElement('div');
        bodyDiv.id = 'section_body_' + section.key;
        watchForErrorsToExpand(bodyDiv, () => {
            if (!expanded) {
                expanded = true;
                updateBodyVisibility();
            }
        });

        function updateBodyVisibility() {
            const hasSelection = currentIntegrationSelections[section.key].length > 0;
            bodyDiv.style.display = (hasSelection && expanded) ? '' : 'none';
            toggleButton.classList.toggle('collapsed', !expanded);
            toggleButton.disabled = !hasSelection;
        }

        if (currentIds.length > 0) {
            renderSectionBody(bodyDiv, section, currentIds);
        }
        updateBodyVisibility();

        toggleButton.addEventListener('click', () => {
            expanded = !expanded;
            updateBodyVisibility();
        });

        const picker = buildIntegrationPicker(section, currentIds, (selectedIds) => {
            const wasEmpty = currentIntegrationSelections[section.key].length === 0;
            currentIntegrationSelections[section.key] = selectedIds;
            if (selectedIds.length > 0) {
                renderSectionBody(bodyDiv, section, selectedIds);
                if (wasEmpty) expanded = true;
            } else {
                bodyDiv.innerHTML = '';
            }
            updateBodyVisibility();
            autoSave();
        });
        heading.appendChild(picker);
        sectionDiv.appendChild(heading);
        sectionDiv.appendChild(bodyDiv);

        container.appendChild(sectionDiv);
    }
}

function renderNotificationSection() {
    const container = document.getElementById('notificationSection');
    container.innerHTML = '';

    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'integrationSection';

    const heading = document.createElement('div');
    heading.className = 'integrationHeading';
    const headingTitle = document.createElement('h2');
    headingTitle.textContent = 'Benachrichtigungen';
    heading.appendChild(headingTitle);
    sectionDiv.appendChild(heading);

    const phoneRow = document.createElement('tr');
    const phoneKeyCell = document.createElement('td');
    phoneKeyCell.textContent = 'Handy';
    phoneKeyCell.appendChild(buildTooltip('Das Handy (Home-Assistant-Mobile-App-Integration), an das shyft-power Benachrichtigungen schicken soll.'));
    const phoneValueCell = document.createElement('td');
    const phoneSelect = document.createElement('select');
    phoneSelect.id = 'notificationPhone';
    phoneSelect.className = 'sensorInput';

    const currentPhone = (configData["notificationTargets"] || {})['phone'] || '';
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '– kein Handy ausgewählt –';
    phoneSelect.appendChild(emptyOption);

    let currentPhoneFound = false;
    for (const target of notificationTargetOptions) {
        const option = document.createElement('option');
        option.value = target.service;
        option.textContent = target.label;
        if (target.service === currentPhone) {
            currentPhoneFound = true;
        }
        phoneSelect.appendChild(option);
    }
    // keep a previously configured target selectable even if it's currently not reported by HA
    // (e.g. app temporarily offline), instead of silently discarding it on the next save
    if (currentPhone && !currentPhoneFound) {
        const staleOption = document.createElement('option');
        staleOption.value = currentPhone;
        staleOption.textContent = currentPhone + ' (nicht gefunden)';
        phoneSelect.appendChild(staleOption);
    }
    phoneSelect.value = currentPhone;
    phoneSelect.addEventListener('change', autoSave);

    phoneValueCell.appendChild(phoneSelect);
    phoneRow.appendChild(phoneKeyCell);
    phoneRow.appendChild(phoneValueCell);

    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    tbody.appendChild(phoneRow);
    table.appendChild(tbody);
    sectionDiv.appendChild(table);

    const notifyHeading = document.createElement('div');
    notifyHeading.className = 'sectionSubHeading controlSectionHeading';
    notifyHeading.textContent = 'Benachrichtigen bei';
    sectionDiv.appendChild(notifyHeading);

    const notifyTable = document.createElement('table');
    const notifyTbody = document.createElement('tbody');
    const notificationsEnabled = configData["notificationsEnabled"] || {};
    for (const [key, label] of Object.entries(NOTIFICATION_TYPES)) {
        const row = document.createElement('tr');
        const keyCell = document.createElement('td');
        keyCell.textContent = label;
        const toggleCell = document.createElement('td');
        toggleCell.className = 'toggleCell';
        toggleCell.appendChild(buildToggleSwitch('notification_' + key + ACTION_TOGGLE_POSTFIX, notificationsEnabled[key] !== false));
        row.appendChild(keyCell);
        row.appendChild(toggleCell);
        notifyTbody.appendChild(row);
    }
    notifyTable.appendChild(notifyTbody);
    sectionDiv.appendChild(notifyTable);

    container.appendChild(sectionDiv);
}

function buildIntegrationPicker(section, currentIds, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'integrationPicker';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'integrationPickerButton';
    const buttonText = document.createElement('span');
    buttonText.className = 'integrationPickerButtonText';
    const buttonArrow = document.createElement('span');
    buttonArrow.className = 'integrationPickerButtonArrow';
    buttonArrow.textContent = '▾';
    button.appendChild(buttonText);
    button.appendChild(buttonArrow);
    wrapper.appendChild(button);

    const panel = document.createElement('div');
    panel.className = 'integrationPickerPanel';
    panel.hidden = true;

    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'integrationPickerSearch';
    search.setAttribute('autocomplete', 'off');
    search.placeholder = 'Suchen...';
    panel.appendChild(search);

    const list = document.createElement('div');
    list.className = 'integrationPickerList';
    panel.appendChild(list);

    wrapper.appendChild(panel);

    const options = integrationsData.integrations.filter(integration =>
        !section.requiresDeviceClass || integrationHasDeviceClass(integration.id, section.requiresDeviceClass)
    );

    let selectedIds = [...currentIds];

    function updateButtonText() {
        if (selectedIds.length === 0) {
            buttonText.textContent = 'nicht vorhanden';
        } else {
            buttonText.textContent = selectedIds
                .map(id => (integrationsData.integrations.find(integration => integration.id === id) || {}).name || id)
                .join(', ');
        }
    }

    function renderList(filterText) {
        list.innerHTML = '';
        const normalizedFilter = (filterText || '').trim().toLowerCase();
        const filtered = options.filter(integration => integration.name.toLowerCase().includes(normalizedFilter));

        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'integrationPickerEmpty';
            empty.textContent = 'Keine Treffer';
            list.appendChild(empty);
            return;
        }

        for (const integration of filtered) {
            const optionLabel = document.createElement('label');
            optionLabel.className = 'integrationPickerOption';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = integration.id;
            checkbox.checked = selectedIds.includes(integration.id);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    if (!selectedIds.includes(integration.id)) {
                        selectedIds.push(integration.id);
                    }
                } else {
                    selectedIds = selectedIds.filter(id => id !== integration.id);
                }
                updateButtonText();
                onChange([...selectedIds]);
            });

            const text = document.createElement('span');
            text.textContent = integration.name;

            optionLabel.appendChild(checkbox);
            optionLabel.appendChild(text);
            list.appendChild(optionLabel);
        }
    }

    search.addEventListener('input', () => renderList(search.value));

    button.addEventListener('click', (event) => {
        event.stopPropagation();
        const wasOpen = !panel.hidden;
        closeOpenIntegrationPicker();
        if (wasOpen) {
            return;
        }
        panel.hidden = false;
        openIntegrationPicker = {wrapper, panel};
        search.value = '';
        renderList('');
        search.focus();
    });

    updateButtonText();

    return wrapper;
}

function renderSectionBody(bodyDiv, section, entryIds) {
    bodyDiv.innerHTML = '';

    const integrationEntityIds = new Set();
    for (const entryId of entryIds) {
        for (const entityId of (integrationsData.entityMap[entryId] || [])) {
            integrationEntityIds.add(entityId);
        }
    }
    const candidateEntities = allSensorIdOptions.filter(entity => integrationEntityIds.has(entity.entity_id));

    if (section.sensors.length > 0) {
        const sensorDatalistIds = {};
        for (const key of section.sensors) {
            const datalistId = 'entityOptions_' + section.key + '_' + key;
            const datalist = document.createElement('datalist');
            datalist.id = datalistId;
            const filter = SENSOR_ENTITY_FILTERS[key];
            for (const entity of candidateEntities) {
                if (entityMatchesSensorFilter(entity, filter)) {
                    const option = document.createElement('option');
                    option.value = entity.label;
                    datalist.appendChild(option);
                }
            }
            bodyDiv.appendChild(datalist);
            sensorDatalistIds[key] = datalistId;
        }

        const sensorsHeading = document.createElement('div');
        sensorsHeading.className = 'sectionSubHeading';
        sensorsHeading.textContent = 'Sensoren';
        bodyDiv.appendChild(sensorsHeading);

        bodyDiv.appendChild(buildMappingTable(section.sensors, configData["sensorMappings"] || {}, helpinformation, VALUE_POSTFIX, key => sensorDatalistIds[key], true));

        if (section.key === 'wallbox') {
            bodyDiv.appendChild(buildWallboxConnectionStatusMapping());
        }
        if (section.key === 'batterie') {
            bodyDiv.appendChild(buildBatteryFlowSignOverrideField());
        }
        if (section.key === 'auto') {
            bodyDiv.appendChild(buildCarBatteryCapacityField());
            bodyDiv.appendChild(buildCarConsumptionField());
        }
    }

    const manualActions = section.actions.filter(key => !AUTO_MANAGED_ACTION_KEYS.has(key) && !CAR_CHARGE_ACTION_KEYS.has(key) && !HOT_WATER_ACTION_KEYS.has(key));
    const sectionControls = AUTO_MANAGED_CONTROLS.filter(c => c.actionKeys.some(k => section.actions.includes(k)));
    const hasCarCharge = section.actions.some(k => CAR_CHARGE_ACTION_KEYS.has(k));
    const hasHotWater = section.actions.some(k => HOT_WATER_ACTION_KEYS.has(k));

    if (manualActions.length > 0 || sectionControls.length > 0 || hasCarCharge || hasHotWater) {
        const controlHeading = document.createElement('div');
        controlHeading.className = 'sectionSubHeading controlSectionHeading';
        controlHeading.textContent = 'Steuerung';
        bodyDiv.appendChild(controlHeading);
    }

    if (manualActions.length > 0) {
        bodyDiv.appendChild(buildMappingTable(manualActions, configData["actorMappings"] || {}, actorHelpInformation, ACTOR_VALUE_POSTFIX, () => 'allEntityOptions', false, configData["actionTypeEnabled"] || {}));
    }

    for (const control of sectionControls) {
        bodyDiv.appendChild(control.type === 'switch' ? buildAutoManagedSwitchControl(control) : buildAutoManagedNumberControl(control));
    }

    if (hasCarCharge) {
        bodyDiv.appendChild(buildCarChargeControl());
    }

    if (hasHotWater) {
        bodyDiv.appendChild(buildHotWaterControl());
    }
}

// Lets the user classify each status value that has actually shown up on their "Wallbox: Auto
// verbunden?" sensor as "Auto kann laden" (physisch eingesteckt) oder "Auto kann nicht laden"
// (abwesend) - needed because most Wallbox-Integrationen ihren eigenen, nicht standardisierten
// Wortschatz für diesen Status verwenden (z.B. "awaiting_authorization"), den das Addon nicht im
// Voraus kennen kann. Diese Zuordnung speist die Anwesenheitsprognose (siehe
// /dashboard/car-presence-forecast).
function buildWallboxConnectionStatusMapping() {
    const wrapper = document.createElement('div');
    wrapper.className = 'wallboxStatusMapping';

    const heading = document.createElement('div');
    heading.className = 'sectionSubHeading';
    heading.textContent = 'Status-Zuordnung für Anwesenheitsprognose';
    heading.appendChild(buildTooltip('Ordne jedem bei dir tatsächlich vorkommenden Wert von "Wallbox: Auto verbunden?" zu, ob er bedeutet, dass das Auto gerade laden kann (physisch eingesteckt) oder nicht (abwesend). Daraus lernt shyft-power mit der Zeit, wann dein Auto typischerweise eingesteckt ist.'));
    wrapper.appendChild(heading);

    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    wrapper.appendChild(table);

    function renderMessageRow(text) {
        tbody.innerHTML = '';
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 2;
        cell.textContent = text;
        row.appendChild(cell);
        tbody.appendChild(row);
    }

    renderMessageRow('Lade beobachtete Status-Werte...');

    (async () => {
        let options = [];
        try {
            options = await getJson(insideHomeAssistant + '/wallbox-connection-status-options');
        } catch (err) {
            console.log(err);
        }
        if (options.length === 0) {
            renderMessageRow('Noch keine Status-Werte beobachtet - sobald "Wallbox: Auto verbunden?" befüllt ist und Werte vorliegen, erscheinen sie hier.');
            return;
        }
        tbody.innerHTML = '';
        const mapping = configData['wallboxConnectionStatusMapping'] || {};
        for (const value of options) {
            const row = document.createElement('tr');
            const labelCell = document.createElement('td');
            labelCell.textContent = value;
            const selectCell = document.createElement('td');
            const select = document.createElement('select');
            select.className = 'sensorInput';
            const unsetOption = document.createElement('option');
            unsetOption.value = '';
            unsetOption.textContent = '– noch nicht zugeordnet –';
            select.appendChild(unsetOption);
            const canChargeOption = document.createElement('option');
            canChargeOption.value = 'true';
            canChargeOption.textContent = 'Auto kann laden / lädt';
            select.appendChild(canChargeOption);
            const cannotChargeOption = document.createElement('option');
            cannotChargeOption.value = 'false';
            cannotChargeOption.textContent = 'Auto kann nicht laden';
            select.appendChild(cannotChargeOption);
            const current = mapping[value];
            select.value = current === true ? 'true' : (current === false ? 'false' : '');
            select.addEventListener('change', () => {
                const updatedMapping = {...(configData['wallboxConnectionStatusMapping'] || {})};
                if (select.value === '') {
                    delete updatedMapping[value];
                } else {
                    updatedMapping[value] = select.value === 'true';
                }
                configData['wallboxConnectionStatusMapping'] = updatedMapping;
                select.classList.toggle('status-error', select.value === '');
                autoSave();
            });
            selectCell.appendChild(select);
            row.appendChild(labelCell);
            row.appendChild(selectCell);
            tbody.appendChild(row);
            // erst NACH dem Einhaengen in den (schon von watchForErrorsToExpand beobachteten) Baum
            // togglen, sonst wird die bereits beim Erzeugen gesetzte Klasse nicht als Mutation
            // erkannt und die Kachel klappt sich bei einer fehlenden Zuordnung nicht automatisch auf
            select.classList.toggle('status-error', select.value === '');
        }
    })();

    return wrapper;
}

// Reine Konfigurationszahl (keine Entity-Zuordnung), gleiches Muster fuer mehrere Felder unter
// "Auto" (Akkukapazitaet, Verbrauch/100km) - siehe buildCarBatteryCapacityField/buildCarConsumptionField.
function buildConfigNumberField({label, tooltip, id, configKey, placeholder, step = '0.1'}) {
    const wrapper = document.createElement('div');
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    const labelCell = document.createElement('td');
    labelCell.textContent = label;
    labelCell.appendChild(buildTooltip(tooltip));
    const valueCell = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    input.id = id;
    input.className = 'sensorInput';
    input.min = '0';
    input.step = step;
    input.placeholder = placeholder;
    input.value = configData[configKey] || '';
    input.addEventListener('change', () => {
        const parsed = parseFloat(input.value);
        configData[configKey] = isNaN(parsed) ? null : parsed;
        autoSave();
    });
    valueCell.appendChild(input);
    row.appendChild(labelCell);
    row.appendChild(valueCell);
    tbody.appendChild(row);
    table.appendChild(tbody);
    wrapper.appendChild(table);
    return wrapper;
}

function buildCarBatteryCapacityField() {
    return buildConfigNumberField({
        label: 'Akkukapazität (kWh)',
        tooltip: 'Diese Angabe benötigt Shyft zur Umrechnung von Ladestandsänderungen der Autobatterie in Stromverbrauch.',
        id: 'car_battery_capacity_kwh',
        configKey: 'carBatteryCapacityKwh',
        placeholder: 'z.B. 60',
    });
}

// Zusammen mit der Akkukapazität die Grundlage für die Reichweitenanzeige (Akkukapazität × SOC ÷
// Verbrauch) im Energiefluss-Widget - und künftig auch umgekehrt: eine gewünschte Reichweite in
// benötigte kWh umrechnen.
function buildCarConsumptionField() {
    return buildConfigNumberField({
        label: 'Verbrauch (kWh/100km)',
        tooltip: 'Diese Angabe benötigt Shyft, um zusammen mit der Akkukapazität die aktuelle Reichweite zu berechnen (und künftig umgekehrt, um eine gewünschte Reichweite in kWh umzurechnen).',
        id: 'car_consumption_kwh_per_100km',
        configKey: 'carConsumptionKwhPer100km',
        placeholder: 'z.B. 18',
    });
}

// Batterie-Fluss-Vorzeichen ist herstellerabhaengig (manche Integrationen melden Laden als
// positiv, andere als negativ) - shyft-power erkennt es automatisch aus dem SOC-Verlauf (siehe
// detect_battery_flow_sign_convention), diese Auswahl ist nur die manuelle Notbremse, falls die
// Erkennung mal danebenliegt oder noch keine Datenbasis hat.
function buildBatteryFlowSignOverrideField() {
    const wrapper = document.createElement('div');
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    const labelCell = document.createElement('td');
    labelCell.textContent = 'Batterie-Vorzeichen';
    labelCell.appendChild(buildTooltip('Positiv soll immer "lädt", negativ "entlädt" bedeuten. Shyft erkennt automatisch, ob dein Sensor das schon so meldet oder umgekehrt (aus dem Verlauf von Ladestand und Leistung). Falls die Darstellung im Dashboard trotzdem falsch herum wirkt, kannst du das Vorzeichen hier manuell umkehren.'));
    const valueCell = document.createElement('td');
    const select = document.createElement('select');
    select.id = 'battery_flow_sign_override';
    select.className = 'sensorInput';
    const detected = configData['batteryFlowSignConvention'];
    const detectedLabel = detected === 'raw_negative_is_charging' ? ' (aktuell erkannt: negativ = lädt)'
        : detected === 'raw_positive_is_charging' ? ' (aktuell erkannt: positiv = lädt)'
        : ' (noch nicht erkannt)';
    for (const [value, text] of [
        ['', 'Automatisch erkennen' + detectedLabel],
        ['false', 'So wie vom Sensor gemeldet (nicht umkehren)'],
        ['true', 'Umgekehrt zum Sensor (Vorzeichen umkehren)'],
    ]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        select.appendChild(option);
    }
    const override = configData['batteryFlowSignOverride'];
    select.value = override === true ? 'true' : (override === false ? 'false' : '');
    select.addEventListener('change', () => {
        configData['batteryFlowSignOverride'] = select.value === '' ? null : select.value === 'true';
        autoSave();
    });
    valueCell.appendChild(select);
    row.appendChild(labelCell);
    row.appendChild(valueCell);
    tbody.appendChild(row);
    table.appendChild(tbody);
    wrapper.appendChild(table);
    return wrapper;
}

function buildAutoActionTitle(control, toggleKey) {
    const title = document.createElement('div');
    title.className = 'autoActionTitle';
    const titleText = document.createElement('span');
    titleText.textContent = control.titleLabel;
    title.appendChild(titleText);
    const checkmark = document.createElement('span');
    checkmark.className = 'autoActionCheckmark';
    checkmark.textContent = ' ✓';
    checkmark.hidden = true;
    title.appendChild(checkmark);
    const toggleChecked = (configData["actionTypeEnabled"] || {})[toggleKey] !== false;
    title.appendChild(buildToggleSwitch(toggleKey + ACTION_TOGGLE_POSTFIX, toggleChecked));
    return {title, checkmark};
}

// "Direkt steuern" vs "HA-Automation" dropdown, shared by every AUTO_MANAGED_CONTROLS entry that
// has hasAutomationVariant set - selecting a value here just toggles which of the two sibling
// wrappers (direct-entity UI vs. automation-entity field(s)) is visible, see callers.
function buildVariantSelect(id, currentValue, directLabel) {
    const select = document.createElement('select');
    select.id = id;
    select.className = 'sensorInput';
    const directOption = document.createElement('option');
    directOption.value = 'direct';
    directOption.textContent = directLabel;
    select.appendChild(directOption);
    const haOption = document.createElement('option');
    haOption.value = 'ha_automation';
    haOption.textContent = 'HA-Automation';
    select.appendChild(haOption);
    select.value = currentValue;
    return select;
}

// One "pick a HA automation" input + datalist, used for every ha_automation variant field (see
// buildCarChargeControl for the original inline version this generalizes).
function buildAutomationEntityRow(labelText, tooltipText, inputId, value, placeholder) {
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    const labelCell = document.createElement('td');
    labelCell.textContent = labelText;
    labelCell.appendChild(buildTooltip(tooltipText));
    const valueCell = document.createElement('td');
    const input = document.createElement('input');
    input.id = inputId;
    input.className = 'sensorInput';
    input.setAttribute('autocomplete', 'off');
    input.value = value || '';
    const datalistId = inputId + '_options';
    const datalist = document.createElement('datalist');
    datalist.id = datalistId;
    for (const entity of allSensorIdOptions.filter(e => e.entity_id.startsWith('automation.'))) {
        const option = document.createElement('option');
        option.value = entity.entity_id;
        option.textContent = entity.label;
        datalist.appendChild(option);
    }
    valueCell.appendChild(datalist);
    input.setAttribute('list', datalistId);
    input.placeholder = placeholder;
    input.addEventListener('change', autoSave);
    valueCell.appendChild(input);
    row.appendChild(labelCell);
    row.appendChild(valueCell);
    tbody.appendChild(row);
    table.appendChild(tbody);
    return table;
}

function buildAutoManagedNumberControl(control) {
    const wrapper = document.createElement('div');
    wrapper.className = 'autoActionControl';

    const {title, checkmark} = buildAutoActionTitle(control, control.actionKeys[0]);
    wrapper.appendChild(title);

    let variant = control.hasAutomationVariant ? ((configData['controlVariant'] || {})[control.key] || 'direct') : 'direct';

    let variantSelect = null;
    let automationRow = null;
    if (control.hasAutomationVariant) {
        variantSelect = buildVariantSelect(control.key + '_variant', variant, 'Direkt steuern');
        const variantTable = document.createElement('table');
        const variantTbody = document.createElement('tbody');
        const variantRow = document.createElement('tr');
        const variantLabelCell = document.createElement('td');
        variantLabelCell.textContent = 'Varianten';
        variantLabelCell.appendChild(buildTooltip('Wie das Addon diese Aktion umsetzt: entweder direkt über eine Home-Assistant-Entität, oder indem es eine selbst erstellte Automation triggert.'));
        const variantValueCell = document.createElement('td');
        variantValueCell.appendChild(variantSelect);
        variantRow.appendChild(variantLabelCell);
        variantRow.appendChild(variantValueCell);
        variantTbody.appendChild(variantRow);
        variantTable.appendChild(variantTbody);
        wrapper.appendChild(variantTable);

        automationRow = buildAutomationEntityRow('HA-Automation auswählen',
            'Zum Auslösen dieser Aktion kannst du deine selber erstellte Automation hinterlegen. Der Zielwert für die Aktion wird als {{ target }} von Shyft übergeben.',
            control.key + '_ha_automation_entity', (configData['actorMappings'] || {})[control.key], 'z.B. automation.meine_aktion');
        automationRow.style.display = variant === 'ha_automation' ? '' : 'none';
        wrapper.appendChild(automationRow);
    }

    const status = document.createElement('div');
    status.className = 'autoActionStatus';
    status.textContent = 'Lade Status...';
    wrapper.appendChild(status);

    const controls = document.createElement('div');
    controls.className = 'autoActionButtons';

    const unitSuffix = control.unit ? ' ' + control.unit : '';
    const minusButton = document.createElement('button');
    minusButton.type = 'button';
    minusButton.textContent = `Test: -${control.step}${unitSuffix}`;

    const plusButton = document.createElement('button');
    plusButton.type = 'button';
    plusButton.textContent = `Test: +${control.step}${unitSuffix}`;

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'autoActionValue';
    valueDisplay.textContent = 'Aktueller Wert: –';

    async function refreshStatus() {
        try {
            const result = await getJson(insideHomeAssistant + '/actions/' + control.key + '/status');
            if (!result.configured) {
                status.textContent = variant === 'ha_automation'
                    ? 'Wähle eine Automation für "' + control.titleLabel + '"'
                    : 'Befülle den Sensor "' + control.titleLabel + '"';
                status.className = 'autoActionStatus status-missing';
                checkmark.hidden = true;
                minusButton.disabled = true;
                plusButton.disabled = true;
                valueDisplay.textContent = 'Aktueller Wert: –';
                return;
            }
            minusButton.disabled = false;
            plusButton.disabled = false;
            if (variant === 'ha_automation') {
                status.textContent = '';
                status.className = 'autoActionStatus status-ok';
                checkmark.hidden = false;
                return;
            }
            if (result.error) {
                status.textContent = 'Eingerichtet, aktueller Wert aber nicht lesbar: ' + result.error;
                status.className = 'autoActionStatus status-error';
                checkmark.hidden = true;
                valueDisplay.textContent = 'Aktueller Wert: –';
            } else {
                status.textContent = '';
                status.className = 'autoActionStatus status-ok';
                checkmark.hidden = false;
                valueDisplay.textContent = 'Aktueller Wert: ' + result.value + unitSuffix;
            }
        } catch (err) {
            console.log(err);
            status.textContent = 'Status konnte nicht geladen werden.';
            status.className = 'autoActionStatus status-error';
            checkmark.hidden = true;
            valueDisplay.textContent = 'Aktueller Wert: –';
        }
    }

    async function runTest(delta) {
        minusButton.disabled = true;
        plusButton.disabled = true;
        valueDisplay.textContent = 'Teste...';
        try {
            const response = await fetch(insideHomeAssistant + '/actions/' + control.key + '/test', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({delta})
            });
            const result = await response.json();
            if (result.success) {
                if (variant === 'ha_automation') {
                    // fire-and-forget - there's no entity to poll back and confirm, unlike the
                    // direct variant's cloud-device round-trip
                    valueDisplay.textContent = 'Gesendet: ' + result.value + unitSuffix;
                } else {
                    // devices reachable only via a manufacturer cloud API can take a while to
                    // report the new value back, so show what we sent right away, then confirm
                    valueDisplay.textContent = 'Gesendet: ' + result.value + unitSuffix + ' (wird geprüft...)';
                    setTimeout(refreshStatus, 4000);
                }
            } else {
                valueDisplay.textContent = 'Fehler: ' + (result.message || 'unbekannt');
            }
        } catch (err) {
            console.log(err);
            valueDisplay.textContent = 'Fehler beim Testen';
        } finally {
            minusButton.disabled = false;
            plusButton.disabled = false;
        }
    }

    minusButton.addEventListener('click', () => runTest(-control.step));
    plusButton.addEventListener('click', () => runTest(control.step));

    controls.appendChild(valueDisplay);
    controls.appendChild(minusButton);
    controls.appendChild(plusButton);
    wrapper.appendChild(controls);

    if (variantSelect) {
        variantSelect.addEventListener('change', () => {
            variant = variantSelect.value;
            automationRow.style.display = variant === 'ha_automation' ? '' : 'none';
            valueDisplay.textContent = 'Aktueller Wert: –';
            autoSave();
            refreshStatus();
        });
    }

    wrapper.__refresh = refreshStatus;
    refreshStatus();

    return wrapper;
}

function buildAutoManagedSwitchControl(control) {
    const wrapper = document.createElement('div');
    wrapper.className = 'autoActionControl';

    const {title, checkmark} = buildAutoActionTitle(control, control.actionKeys[0]);
    wrapper.appendChild(title);

    let variant = control.hasAutomationVariant ? ((configData['controlVariant'] || {})[control.key] || 'direct') : 'direct';

    let variantSelect = null;
    let automationRows = null;
    if (control.hasAutomationVariant) {
        variantSelect = buildVariantSelect(control.key + '_variant', variant, 'Entität ein-/ausschalten');
        const variantTable = document.createElement('table');
        const variantTbody = document.createElement('tbody');
        const variantRow = document.createElement('tr');
        const variantLabelCell = document.createElement('td');
        variantLabelCell.textContent = 'Varianten';
        variantLabelCell.appendChild(buildTooltip('Wie das Addon diese Aktion umsetzt: entweder direkt über eine Home-Assistant-Entität, oder indem es selbst erstellte Automationen triggert.'));
        const variantValueCell = document.createElement('td');
        variantValueCell.appendChild(variantSelect);
        variantRow.appendChild(variantLabelCell);
        variantRow.appendChild(variantValueCell);
        variantTbody.appendChild(variantRow);
        variantTable.appendChild(variantTbody);
        wrapper.appendChild(variantTable);

        automationRows = document.createElement('div');
        const actorMappings = configData['actorMappings'] || {};
        automationRows.appendChild(buildAutomationEntityRow('Sonstigen Verbraucher starten',
            'Automation, die beim Start dieser Aktion getriggert wird. Der Zielwert wird als {{ target }} übergeben.',
            'consumer_on_ha_automation_entity', actorMappings['consumer_on'], 'z.B. automation.verbraucher_starten'));
        automationRows.appendChild(buildAutomationEntityRow('Sonstigen Verbraucher beenden',
            'Automation, die beim Beenden dieser Aktion getriggert wird.',
            'consumer_off_ha_automation_entity', actorMappings['consumer_off'], 'z.B. automation.verbraucher_beenden'));
        automationRows.style.display = variant === 'ha_automation' ? '' : 'none';
        wrapper.appendChild(automationRows);
    }

    const status = document.createElement('div');
    status.className = 'autoActionStatus';
    status.textContent = 'Lade Status...';
    wrapper.appendChild(status);

    const controlsRow = document.createElement('div');
    controlsRow.className = 'autoActionButtons';

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'autoActionValue';
    valueDisplay.textContent = 'Aktueller Status: –';

    // Single button instead of a toggle - it alternates Start/Ende on each click rather than
    // reflecting/setting an on/off state directly, since the ha_automation variant has no entity
    // to read a real state from in the first place.
    let nextPhase = 'start';
    const testButton = document.createElement('button');
    testButton.type = 'button';
    testButton.textContent = 'Test: Start';

    async function refreshStatus() {
        try {
            const result = await getJson(insideHomeAssistant + '/actions/' + control.key + '/status');
            if (!result.configured) {
                status.textContent = variant === 'ha_automation'
                    ? 'Befülle beide Automationsfelder für "' + control.titleLabel + '"'
                    : 'Befülle den Sensor "' + control.titleLabel + '"';
                status.className = 'autoActionStatus status-missing';
                checkmark.hidden = true;
                testButton.disabled = true;
                valueDisplay.textContent = 'Aktueller Status: –';
                return;
            }
            testButton.disabled = false;
            if (variant === 'ha_automation') {
                status.textContent = '';
                status.className = 'autoActionStatus status-ok';
                checkmark.hidden = false;
                return;
            }
            if (result.error) {
                status.textContent = 'Eingerichtet, aktueller Status aber nicht lesbar: ' + result.error;
                status.className = 'autoActionStatus status-error';
                checkmark.hidden = true;
                valueDisplay.textContent = 'Aktueller Status: –';
            } else {
                status.textContent = '';
                status.className = 'autoActionStatus status-ok';
                checkmark.hidden = false;
                const isOn = result.value === 'on';
                valueDisplay.textContent = 'Aktueller Status: ' + (isOn ? 'An' : 'Aus');
                // next click should do the opposite of whatever the entity actually reports
                nextPhase = isOn ? 'stop' : 'start';
                testButton.textContent = nextPhase === 'start' ? 'Test: Start' : 'Test: Ende';
            }
        } catch (err) {
            console.log(err);
            status.textContent = 'Status konnte nicht geladen werden.';
            status.className = 'autoActionStatus status-error';
            checkmark.hidden = true;
            valueDisplay.textContent = 'Aktueller Status: –';
        }
    }

    testButton.addEventListener('click', async () => {
        const phase = nextPhase;
        testButton.disabled = true;
        valueDisplay.textContent = 'Teste...';
        try {
            const response = await fetch(insideHomeAssistant + '/actions/' + control.key + '/test', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({phase})
            });
            const result = await response.json();
            if (result.success) {
                const phaseLabel = phase === 'start' ? 'Start' : 'Ende';
                if (variant === 'ha_automation') {
                    // fire-and-forget - no entity to poll back and confirm
                    valueDisplay.textContent = 'Gesendet: ' + phaseLabel;
                    nextPhase = phase === 'start' ? 'stop' : 'start';
                    testButton.textContent = nextPhase === 'start' ? 'Test: Start' : 'Test: Ende';
                } else {
                    valueDisplay.textContent = 'Gesendet: ' + phaseLabel + ' (wird geprüft...)';
                    setTimeout(refreshStatus, 4000);
                }
            } else {
                valueDisplay.textContent = 'Fehler: ' + (result.message || 'unbekannt');
            }
        } catch (err) {
            console.log(err);
            valueDisplay.textContent = 'Fehler beim Testen';
        } finally {
            testButton.disabled = false;
        }
    });

    controlsRow.appendChild(valueDisplay);
    controlsRow.appendChild(testButton);
    wrapper.appendChild(controlsRow);

    if (variantSelect) {
        variantSelect.addEventListener('change', () => {
            variant = variantSelect.value;
            automationRows.style.display = variant === 'ha_automation' ? '' : 'none';
            valueDisplay.textContent = 'Aktueller Status: –';
            nextPhase = 'start';
            testButton.textContent = 'Test: Start';
            autoSave();
            refreshStatus();
        });
    }

    wrapper.__refresh = refreshStatus;
    refreshStatus();

    return wrapper;
}

// "Auto laden" doesn't fit the uniform AUTO_MANAGED_CONTROLS shape: it's a manufacturer-varying
// command sequence (currently one recipe, "Dreistufig": set phase count, then Ampere, then start charging) plus
// an independent single-action "Laden beenden". Kept separate from AUTO_MANAGED_CONTROLS since the
// concrete kW->Phasen/Ampere math lives entirely server-side (see compute_charging_phases_and_amps).
// Domains eligible as a Befehl for a given integration section (e.g. "Auto laden" -> 'wallbox',
// "Warmwasserbereitung" -> 'waermepumpe'): generic controllable-entity domains, plus whatever
// domain(s) the currently selected integration(s) for that section belong to (e.g. 'easee',
// 'vicare') - so integration-specific services like easee.set_charger_phase_mode or a ViCare
// service show up as candidates too.
function getIntegrationServiceDomains(integrationKey) {
    const domains = new Set(['number', 'select', 'button', 'switch']);
    const selectedIds = currentIntegrationSelections[integrationKey] || [];
    for (const integration of integrationsData.integrations) {
        if (selectedIds.includes(integration.id)) {
            const match = integration.name.match(/\(([^)]+)\)$/);
            if (match) domains.add(match[1]);
        }
    }
    return domains;
}

// Devices belonging to the currently selected integration(s) for a given section - lets a service
// field with a "device" selector (e.g. easee.set_charger_phase_mode's device_id) be filled by
// picking from the user's own already-selected device instead of typing a device registry id by
// hand.
function getIntegrationDevices(integrationKey) {
    const selectedIds = currentIntegrationSelections[integrationKey] || [];
    const devices = [];
    for (const entryId of selectedIds) {
        for (const device of (integrationsData.deviceMap || {})[entryId] || []) {
            devices.push(device);
        }
    }
    return devices;
}

// One field-set for a recipe stage's Home Assistant service: static fields (no fixed choices,
// e.g. device_id) get a single input shared across both branches; fields with a fixed set of
// choices (a "select" selector, e.g. easee.action_command's action_command) get one dropdown per
// branch (e.g. one under "Ladevorgang starten", one under "Ladevorgang beenden") since that's
// exactly the kind of field that differs between the two - the user never has to know or type the
// raw values, and the addon assembles the actual service-call data at runtime (see
// call_recipe_stage in app.py).
function buildBranchedStageFields(idPrefix, stageKey, label, tooltip, candidateServices, stageData, branchKeys, branchLabels, placeholderExample, amountUnit, showDot = true) {
    const wrapper = document.createElement('div');
    wrapper.className = 'carChargeStage';

    if (showDot) {
        // marks this step on the continuous vertical line running down .carChargeStages (see CSS)
        // - positioned relative to this stage's own top so it lines up with "1./2./3. ..."
        // regardless of how tall the previous stages ended up being. Single-stage recipes (e.g.
        // "Warmwasserbereitung") aren't wrapped in .carChargeStages and skip this - a lone dot with
        // no line to sit on would misleadingly suggest a multi-step process.
        const stageDot = document.createElement('span');
        stageDot.className = 'carChargeStageDot';
        wrapper.appendChild(stageDot);
    }

    const serviceDatalistId = idPrefix + 'ServiceOptions_' + stageKey;
    const serviceDatalist = document.createElement('datalist');
    serviceDatalist.id = serviceDatalistId;
    for (const s of candidateServices) {
        const option = document.createElement('option');
        option.value = s.service;
        option.textContent = s.label;
        serviceDatalist.appendChild(option);
    }
    wrapper.appendChild(serviceDatalist);

    const serviceTable = document.createElement('table');
    const serviceTbody = document.createElement('tbody');
    const serviceRow = document.createElement('tr');
    const serviceLabelCell = document.createElement('td');
    serviceLabelCell.textContent = label;
    serviceLabelCell.appendChild(buildTooltip(tooltip));
    const serviceValueCell = document.createElement('td');
    const serviceInput = document.createElement('input');
    serviceInput.id = idPrefix + stageKey + '_service';
    serviceInput.value = stageData.service || '';
    serviceInput.setAttribute('list', serviceDatalistId);
    serviceInput.setAttribute('class', 'sensorInput');
    serviceInput.setAttribute('autocomplete', 'off');
    serviceInput.placeholder = placeholderExample;
    serviceValueCell.appendChild(serviceInput);
    serviceRow.appendChild(serviceLabelCell);
    serviceRow.appendChild(serviceValueCell);
    serviceTbody.appendChild(serviceRow);
    serviceTable.appendChild(serviceTbody);
    wrapper.appendChild(serviceTable);

    const fieldsContainer = document.createElement('div');
    wrapper.appendChild(fieldsContainer);

    function renderFields() {
        fieldsContainer.innerHTML = '';
        const match = allServiceOptions.find(s => s.service === serviceInput.value);
        if (!match) return;
        const staticFields = match.fields.filter(f => f.options.length === 0);
        const enumFields = match.fields.filter(f => f.options.length > 0);

        // device-selector fields (e.g. device_id) are never shown at all - there's exactly one
        // device to mean (the already-selected integration's own), so saveConfigurationNow fills
        // it in directly via getIntegrationDevices() rather than rendering anything to pick.
        // In a stage that cares about an amount field (amountUnit set - currently only the
        // amperage stage), ALL number fields are hidden, not just the one matching that unit:
        // the matching one always gets the freshly computed value, and any other (e.g. Easee's
        // time_to_live) is config-once data that isn't worth a permanent input either - it just
        // keeps whatever was last configured (see readStageFromDom's previousSharedFields).
        const visibleStaticFields = staticFields.filter(f => !f.isDevice && !(amountUnit && f.isNumber));

        if (visibleStaticFields.length > 0) {
            const staticTable = document.createElement('table');
            const staticTbody = document.createElement('tbody');
            for (const field of visibleStaticFields) {
                const row = document.createElement('tr');
                const keyCell = document.createElement('td');
                keyCell.textContent = field.label;
                const valueCell = document.createElement('td');

                const input = document.createElement('input');
                input.id = idPrefix + stageKey + '_field_' + field.name;
                input.className = 'sensorInput';
                input.setAttribute('autocomplete', 'off');
                input.value = (stageData.sharedFields || {})[field.name] || '';
                if (field.isEntity) {
                    // an "entity_id" target selector (e.g. number.set_value) has no fixed
                    // choices of its own - offer a searchable dropdown of known entities
                    // instead of asking the user to type an id by hand, narrowed to the
                    // relevant unit where given (e.g. "A" for the amperage stage, so only
                    // Ladestrom-Entitäten show up)
                    const entityDatalistId = idPrefix + 'EntityOptions_' + stageKey + '_' + field.name;
                    const entityDatalist = document.createElement('datalist');
                    entityDatalist.id = entityDatalistId;
                    const candidates = amountUnit
                        ? allSensorIdOptions.filter(e => e.unit === amountUnit)
                        : allSensorIdOptions;
                    for (const entity of candidates) {
                        const option = document.createElement('option');
                        option.value = entity.entity_id;
                        option.textContent = entity.label;
                        entityDatalist.appendChild(option);
                    }
                    fieldsContainer.appendChild(entityDatalist);
                    input.setAttribute('list', entityDatalistId);
                    input.placeholder = amountUnit
                        ? `z.B. number.wallbox_ladestrom (gefiltert nach Einheit "${amountUnit}")`
                        : 'z.B. number.wallbox_ladestrom';
                }
                input.addEventListener('change', autoSave);
                valueCell.appendChild(input);
                row.appendChild(keyCell);
                row.appendChild(valueCell);
                staticTbody.appendChild(row);
            }
            staticTable.appendChild(staticTbody);
            fieldsContainer.appendChild(staticTable);
        }

        if (enumFields.length > 0) {
            const branchGroup = document.createElement('div');
            branchGroup.className = 'branchFieldsGroup';
            const branchTable = document.createElement('table');
            const branchTbody = document.createElement('tbody');
            for (let i = 0; i < branchKeys.length; i++) {
                const branchKey = branchKeys[i];
                for (const field of enumFields) {
                    const row = document.createElement('tr');
                    const keyCell = document.createElement('td');
                    // a single enum field is the common case (e.g. just "mode") - name the row
                    // after the branch itself ("Mit 1 Phase laden") rather than the field, since
                    // that's clearer than a generic field label repeated for every branch
                    keyCell.textContent = enumFields.length === 1 ? branchLabels[i] : `${branchLabels[i]}: ${field.label}`;
                    const valueCell = document.createElement('td');
                    const select = document.createElement('select');
                    select.id = idPrefix + stageKey + '_branch_' + branchKey + '_field_' + field.name;
                    select.className = 'sensorInput';
                    for (const opt of field.options) {
                        const optionEl = document.createElement('option');
                        optionEl.value = opt.value;
                        optionEl.textContent = String(opt.label) === String(opt.value) ? opt.label : `${opt.label} (${opt.value})`;
                        select.appendChild(optionEl);
                    }
                    const currentValue = ((stageData.branchFields || {})[branchKey] || {})[field.name];
                    if (currentValue !== undefined) select.value = currentValue;
                    select.addEventListener('change', autoSave);
                    valueCell.appendChild(select);
                    row.appendChild(keyCell);
                    row.appendChild(valueCell);
                    branchTbody.appendChild(row);
                }
            }
            branchTable.appendChild(branchTbody);
            branchGroup.appendChild(branchTable);
            fieldsContainer.appendChild(branchGroup);
        }
    }

    serviceInput.addEventListener('change', () => {
        renderFields();
        autoSave();
    });
    renderFields();

    return wrapper;
}

function buildCarChargeControl() {
    const wrapper = document.createElement('div');
    wrapper.className = 'autoActionControl';

    const {title, checkmark} = buildAutoActionTitle({titleLabel: 'Auto laden'}, 'car_charge_start');
    wrapper.appendChild(title);

    const recipe = configData['carChargeRecipe'] || {};
    const phaseCountStage = recipe.phaseCount || {};
    const amperageStage = recipe.amperage || {};
    const controlStage = recipe.control || {};
    const isThreeStageComplete = recipe.type === 'three_stage' && phaseCountStage.service
        && amperageStage.service && (amperageStage.amountFields || []).length > 0 && controlStage.service;
    const isHaAutomationComplete = recipe.type === 'ha_automation' && !!recipe.haAutomationEntityId;
    checkmark.hidden = !(isThreeStageComplete || isHaAutomationComplete);

    const candidateServices = allServiceOptions.filter(s => getIntegrationServiceDomains('wallbox').has(s.service.split('.')[0]));

    const variantsHeading = document.createElement('div');
    variantsHeading.className = 'sectionSubHeading';
    variantsHeading.textContent = 'Auto laden';
    wrapper.appendChild(variantsHeading);

    const recipeTable = document.createElement('table');
    const recipeTbody = document.createElement('tbody');
    const recipeRow = document.createElement('tr');
    const recipeLabelCell = document.createElement('td');
    recipeLabelCell.textContent = 'Varianten';
    recipeLabelCell.appendChild(buildTooltip('Wie das Addon deine Wallbox ansteuert, um einen Ladevorgang zu starten. "Dreistufig" setzt zuerst die Phasenzahl, dann die Amperezahl, dann startet es den Ladevorgang.'));
    const recipeValueCell = document.createElement('td');
    const recipeSelect = document.createElement('select');
    recipeSelect.id = 'car_charge_recipe_type';
    recipeSelect.className = 'sensorInput';
    const noRecipeOption = document.createElement('option');
    noRecipeOption.value = '';
    noRecipeOption.textContent = '– keine Variante ausgewählt –';
    recipeSelect.appendChild(noRecipeOption);
    const threeStageOption = document.createElement('option');
    threeStageOption.value = 'three_stage';
    threeStageOption.textContent = 'Dreistufig';
    recipeSelect.appendChild(threeStageOption);
    const haAutomationOption = document.createElement('option');
    haAutomationOption.value = 'ha_automation';
    haAutomationOption.textContent = 'HA-Automation';
    recipeSelect.appendChild(haAutomationOption);
    recipeSelect.value = recipe.type || '';
    recipeValueCell.appendChild(recipeSelect);
    recipeRow.appendChild(recipeLabelCell);
    recipeRow.appendChild(recipeValueCell);
    recipeTbody.appendChild(recipeRow);
    recipeTable.appendChild(recipeTbody);
    wrapper.appendChild(recipeTable);

    const stagesWrapper = document.createElement('div');
    stagesWrapper.className = 'carChargeStages';
    // a single continuous line (border-left on stagesWrapper itself, see .carChargeStages)
    // now runs alongside all three numbered steps, with a dot marking each one (see the
    // "stageDot" appended inside buildBranchedStageFields) - replaces the old per-gap connector
    stagesWrapper.appendChild(buildBranchedStageFields('car_charge_', 'phaseCount', '1. Phasenanzahl setzen',
        'Befehl, mit dem die Phasenzahl an deiner Wallbox eingestellt wird.',
        candidateServices, phaseCountStage,
        CAR_CHARGE_STAGE_BRANCHES.phaseCount.keys, CAR_CHARGE_STAGE_BRANCHES.phaseCount.labels,
        'z.B. set_charger_phase_mode'));
    stagesWrapper.appendChild(buildBranchedStageFields('car_charge_', 'amperage', '2. Amperezahl setzen',
        'Befehl, mit dem die Ladestromstärke (Ampere) an deiner Wallbox eingestellt wird. Wähle die Entität, die den Ladestrom entgegennimmt (meist eine number-Entität mit Einheit "A") - das Addon berechnet die passende Amperezahl aus dem Ziel-kW-Wert von shyft-power und sendet sie automatisch.',
        candidateServices, amperageStage,
        CAR_CHARGE_STAGE_BRANCHES.amperage.keys, CAR_CHARGE_STAGE_BRANCHES.amperage.labels,
        'z.B. set_value', CAR_CHARGE_STAGE_BRANCHES.amperage.amountUnit));
    stagesWrapper.appendChild(buildBranchedStageFields('car_charge_', 'control', '3. Ladevorgang steuern',
        'Befehl, mit dem der Ladevorgang gestartet bzw. beendet wird.',
        candidateServices, controlStage,
        CAR_CHARGE_STAGE_BRANCHES.control.keys, CAR_CHARGE_STAGE_BRANCHES.control.labels,
        'z.B. action_command'));
    stagesWrapper.style.display = recipeSelect.value === 'three_stage' ? '' : 'none';
    wrapper.appendChild(stagesWrapper);

    // "HA-Automation" is the alternative to the 3-stage recipe: instead of the addon driving
    // individual services itself, it just triggers the user's own automation with target/phase
    // as template variables ({{ target }}, {{ phase }}) - see trigger_ha_automation_recipe in
    // app.py. Only ever one or the other is shown, matching recipeSelect's current value.
    const automationWrapper = document.createElement('div');
    const automationTable = document.createElement('table');
    const automationTbody = document.createElement('tbody');
    const automationRow = document.createElement('tr');
    const automationLabelCell = document.createElement('td');
    automationLabelCell.textContent = 'HA-Automation auswählen';
    automationLabelCell.appendChild(buildTooltip('Zum Starten bzw. Beenden einer Shyft-Aktion kannst du deine selber erstellte Automation hinterlegen. Der Zielwert für die Aktion wird als {{ target }} von Shyft übergeben, und ob gerade gestartet oder beendet wird als {{ phase }} ("start"/"stop").'));
    const automationValueCell = document.createElement('td');
    const automationInput = document.createElement('input');
    automationInput.id = 'car_charge_ha_automation_entity';
    automationInput.className = 'sensorInput';
    automationInput.setAttribute('autocomplete', 'off');
    automationInput.value = recipe.haAutomationEntityId || '';
    const automationDatalistId = 'carChargeAutomationOptions';
    const automationDatalist = document.createElement('datalist');
    automationDatalist.id = automationDatalistId;
    for (const entity of allSensorIdOptions.filter(e => e.entity_id.startsWith('automation.'))) {
        const option = document.createElement('option');
        option.value = entity.entity_id;
        option.textContent = entity.label;
        automationDatalist.appendChild(option);
    }
    automationValueCell.appendChild(automationDatalist);
    automationInput.setAttribute('list', automationDatalistId);
    automationInput.placeholder = 'z.B. automation.mein_auto_laden';
    automationInput.addEventListener('change', autoSave);
    automationValueCell.appendChild(automationInput);
    automationRow.appendChild(automationLabelCell);
    automationRow.appendChild(automationValueCell);
    automationTbody.appendChild(automationRow);
    automationTable.appendChild(automationTbody);
    automationWrapper.appendChild(automationTable);
    automationWrapper.style.display = recipeSelect.value === 'ha_automation' ? '' : 'none';
    wrapper.appendChild(automationWrapper);

    recipeSelect.addEventListener('change', () => {
        stagesWrapper.style.display = recipeSelect.value === 'three_stage' ? '' : 'none';
        automationWrapper.style.display = recipeSelect.value === 'ha_automation' ? '' : 'none';
        autoSave();
    });

    const status = document.createElement('div');
    status.className = 'autoActionStatus';
    wrapper.appendChild(status);

    const controlsRow = document.createElement('div');
    controlsRow.className = 'autoActionButtons';

    const wallboxStatusDisplay = document.createElement('span');
    wallboxStatusDisplay.className = 'autoActionValue';

    function refreshWallboxStatus() {
        const wallboxEntity = (configData['sensorMappings'] || {})['wallbox_plugged'] || '';
        if (!wallboxEntity) {
            wallboxStatusDisplay.textContent = 'Wallbox-Status: – (kein Sensor zugeordnet)';
            return;
        }
        const match = allSensorIdOptions.find(e => e.entity_id === wallboxEntity);
        wallboxStatusDisplay.textContent = 'Wallbox-Status: ' + (match ? match.state : '–');
    }

    // 2,3 kW and 6,9 kW deliberately picked so the resulting Amperezahl has no decimals (10 A in
    // both cases - 2,3 kW at 1 Phase, 6,9 kW at 3 Phasen), covering both branches of
    // compute_charging_phases_and_amps with a single click each.
    const testButtons = [];
    for (const targetKw of [2.3, 6.9]) {
        const testButton = document.createElement('button');
        testButton.type = 'button';
        testButton.textContent = `Test: mit ${targetKw.toFixed(1).replace('.', ',')} kW laden`;
        testButton.addEventListener('click', async () => {
            for (const b of testButtons) b.disabled = true;
            testStopButton.disabled = true;
            // three sequential HA calls with a 10s pause between each (see CHARGING_STAGE_DELAY_SECONDS
            // in app.py) add up to a noticeable wait - let the user know it's not stuck
            status.textContent = 'Teste (ca. 30s...)';
            status.className = 'autoActionStatus';
            try {
                const response = await fetch(insideHomeAssistant + '/actions/car_charge_start/test', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({targetKw})
                });
                const result = await response.json();
                if (result.success) {
                    status.textContent = result.phaseCount !== undefined
                        ? `Gesendet: ${result.phaseCount} Phase(n), Laden gestartet.`
                        : 'Gesendet: Laden gestartet.';
                    status.className = 'autoActionStatus status-ok';
                    setTimeout(refreshWallboxStatus, 4000);
                } else {
                    status.textContent = 'Fehler: ' + (result.message || 'unbekannt');
                    status.className = 'autoActionStatus status-error';
                }
            } catch (err) {
                console.log(err);
                status.textContent = 'Fehler beim Testen';
                status.className = 'autoActionStatus status-error';
            } finally {
                for (const b of testButtons) b.disabled = false;
                testStopButton.disabled = false;
            }
        });
        testButtons.push(testButton);
    }

    const testStopButton = document.createElement('button');
    testStopButton.type = 'button';
    testStopButton.textContent = 'Test: Laden beenden';
    testStopButton.addEventListener('click', async () => {
        for (const b of testButtons) b.disabled = true;
        testStopButton.disabled = true;
        status.textContent = 'Teste...';
        status.className = 'autoActionStatus';
        try {
            const response = await fetch(insideHomeAssistant + '/actions/car_charge_stop/test', {method: 'POST'});
            const result = await response.json();
            if (result.success) {
                status.textContent = 'Gesendet: Laden beendet.';
                status.className = 'autoActionStatus status-ok';
                setTimeout(refreshWallboxStatus, 4000);
            } else {
                status.textContent = 'Fehler: ' + (result.message || 'unbekannt');
                status.className = 'autoActionStatus status-error';
            }
        } catch (err) {
            console.log(err);
            status.textContent = 'Fehler beim Testen';
            status.className = 'autoActionStatus status-error';
        } finally {
            for (const b of testButtons) b.disabled = false;
            testStopButton.disabled = false;
        }
    });

    controlsRow.appendChild(wallboxStatusDisplay);
    for (const b of testButtons) controlsRow.appendChild(b);
    controlsRow.appendChild(testStopButton);
    wrapper.appendChild(controlsRow);

    wrapper.__refresh = refreshWallboxStatus;
    refreshWallboxStatus();

    return wrapper;
}

// "Warmwasserbereitung" is a single fixed action (e.g. a Wärmepumpe-integration's "one-time DHW
// charge" service) rather than a multi-stage recipe like "Auto laden" - one service+field picker,
// filtered to the selected Wärmepumpe integration's own domain/device, no branches needed.
function buildHotWaterControl() {
    const wrapper = document.createElement('div');
    wrapper.className = 'autoActionControl';

    const {title, checkmark} = buildAutoActionTitle({titleLabel: 'Warmwasserbereitung'}, 'hot_water');
    wrapper.appendChild(title);

    const recipe = configData['hotWaterRecipe'] || {};
    let variant = recipe.type === 'ha_automation' ? 'ha_automation' : 'direct';
    checkmark.hidden = variant === 'ha_automation' ? !recipe.haAutomationEntityId : !recipe.service;

    const candidateServices = allServiceOptions.filter(s => getIntegrationServiceDomains('waermepumpe').has(s.service.split('.')[0]));
    const stageWrapper = buildBranchedStageFields('hot_water_', 'hotWater', 'Befehl',
        'Befehl, mit dem die (einmalige) Warmwasserbereitung an deiner Wärmepumpe aktiviert wird.',
        candidateServices, recipe, [], [], 'z.B. activate_onetimecharge', undefined, false);
    stageWrapper.style.display = variant === 'direct' ? '' : 'none';
    wrapper.appendChild(stageWrapper);

    const variantSelect = buildVariantSelect('hot_water_variant', variant, 'Befehl auswählen');
    const variantTable = document.createElement('table');
    const variantTbody = document.createElement('tbody');
    const variantRow = document.createElement('tr');
    const variantLabelCell = document.createElement('td');
    variantLabelCell.textContent = 'Varianten';
    variantLabelCell.appendChild(buildTooltip('Wie das Addon die Warmwasserbereitung auslöst: entweder direkt über einen Wärmepumpen-Befehl, oder indem es eine selbst erstellte Automation triggert.'));
    const variantValueCell = document.createElement('td');
    variantValueCell.appendChild(variantSelect);
    variantRow.appendChild(variantLabelCell);
    variantRow.appendChild(variantValueCell);
    variantTbody.appendChild(variantRow);
    variantTable.appendChild(variantTbody);
    wrapper.appendChild(variantTable);

    const automationRow = buildAutomationEntityRow('HA-Automation auswählen',
        'Zum Auslösen der Warmwasserbereitung kannst du deine selber erstellte Automation hinterlegen.',
        'hot_water_ha_automation_entity', recipe.haAutomationEntityId, 'z.B. automation.warmwasser_starten');
    automationRow.style.display = variant === 'ha_automation' ? '' : 'none';
    wrapper.appendChild(automationRow);

    const automationInput = automationRow.querySelector('input');
    function refreshCheckmark() {
        if (variant === 'ha_automation') {
            checkmark.hidden = !automationInput.value;
        } else {
            const serviceInput = document.getElementById('hot_water_hotWater_service');
            checkmark.hidden = !(serviceInput && serviceInput.value);
        }
    }
    automationInput.addEventListener('change', refreshCheckmark);
    const hotWaterServiceInput = document.getElementById('hot_water_hotWater_service');
    if (hotWaterServiceInput) hotWaterServiceInput.addEventListener('change', refreshCheckmark);

    variantSelect.addEventListener('change', () => {
        variant = variantSelect.value;
        stageWrapper.style.display = variant === 'direct' ? '' : 'none';
        automationRow.style.display = variant === 'ha_automation' ? '' : 'none';
        refreshCheckmark();
        autoSave();
    });

    const status = document.createElement('div');
    status.className = 'autoActionStatus';
    wrapper.appendChild(status);

    const controlsRow = document.createElement('div');
    controlsRow.className = 'autoActionButtons';

    const statusDisplay = document.createElement('span');
    statusDisplay.className = 'autoActionValue';

    // shows the mapped "Warmwassermodus aktiviert?" sensor's own state - an honest read of
    // whatever the Wärmepumpe integration reports, not a claim that the test call itself is
    // being verified (see the "(wird geprüft...)" wording fix for why that distinction matters)
    function refreshHotWaterStatus() {
        const entity = (configData['sensorMappings'] || {})['heatpump_dhw_activated'] || '';
        if (!entity) {
            statusDisplay.textContent = 'Warmwassermodus: – (kein Sensor zugeordnet)';
            return;
        }
        const match = allSensorIdOptions.find(e => e.entity_id === entity);
        statusDisplay.textContent = 'Warmwassermodus: ' + (match ? match.state : '–');
    }

    const testButton = document.createElement('button');
    testButton.type = 'button';
    testButton.textContent = 'Test: Warmwasserbereitung';
    testButton.addEventListener('click', async () => {
        testButton.disabled = true;
        status.textContent = 'Teste...';
        status.className = 'autoActionStatus';
        try {
            const response = await fetch(insideHomeAssistant + '/actions/hot_water_activate/test', {method: 'POST'});
            const result = await response.json();
            if (result.success) {
                status.textContent = 'Gesendet: Warmwasserbereitung aktiviert.';
                status.className = 'autoActionStatus status-ok';
                setTimeout(refreshHotWaterStatus, 4000);
            } else {
                status.textContent = 'Fehler: ' + (result.message || 'unbekannt');
                status.className = 'autoActionStatus status-error';
            }
        } catch (err) {
            console.log(err);
            status.textContent = 'Fehler beim Testen';
            status.className = 'autoActionStatus status-error';
        } finally {
            testButton.disabled = false;
        }
    });

    controlsRow.appendChild(statusDisplay);
    controlsRow.appendChild(testButton);
    wrapper.appendChild(controlsRow);

    wrapper.__refresh = refreshHotWaterStatus;
    refreshHotWaterStatus();

    return wrapper;
}

function buildMappingTable(keys, mappingData, helpInfo, valuePostfix, getDatalistId, showLiveValue, toggleData) {
    const table = document.createElement('table');

    const tbody = document.createElement('tbody');
    for (const key of keys) {
        const hasToggle = !!toggleData && ACTION_TYPE_TOGGLE_KEYS.has(key);
        tbody.appendChild(buildMappingRow(key, mappingData[key] || '', helpInfo, valuePostfix, getDatalistId(key), showLiveValue, hasToggle ? (toggleData[key] !== false) : null));
    }
    table.appendChild(tbody);

    return table;
}

function buildBareToggleSwitch(checked) {
    const label = document.createElement('label');
    label.className = 'toggleSwitch';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    const slider = document.createElement('span');
    slider.className = 'toggleSlider';
    label.appendChild(input);
    label.appendChild(slider);
    return label;
}

function buildToggleSwitch(id, checked) {
    const label = buildBareToggleSwitch(checked);
    const input = label.querySelector('input');
    input.id = id;
    input.addEventListener('change', autoSave);
    return label;
}

function extractEntityId(value) {
    return (value || '').split(/[:\s]/)[0];
}

function formatEntityDisplay(entityId) {
    if (!entityId) return '';
    const match = allSensorIdOptions.find(entity => entity.entity_id === entityId);
    if (!match) return entityId;
    const stateAndUnit = match.label.slice(match.entity_id.length + 2, -1); // strip "entity_id (" prefix and trailing ")"
    return `${entityId} (${stateAndUnit})`;
}

function buildTooltip(description) {
    const tooltip = document.createElement("span");
    tooltip.className = 'tooltip';
    const tooltipIcon = document.createElement("span");
    tooltipIcon.className = 'tooltip-icon';
    tooltipIcon.textContent = '?';
    tooltip.appendChild(tooltipIcon);
    const tooltipText = document.createElement("span");
    tooltipText.className = 'tooltip-text';
    tooltipText.textContent = description;
    tooltip.appendChild(tooltipText);
    return tooltip;
}

function buildMappingRow(key, value, helpInfo, valuePostfix, datalistId, showLiveValue, toggleChecked) {
    const row = document.createElement('tr');
    const keyCell = document.createElement('td');
    const context = helpInfo[key] ?? {label: key};
    keyCell.textContent = context.label;
    keyCell.appendChild(buildTooltip(context.description ?? key));

    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'clearableInput';

    const inputValue = document.createElement('input');
    inputValue.id = key + valuePostfix;
    inputValue.value = showLiveValue ? formatEntityDisplay(value) : value;
    inputValue.setAttribute("list", datalistId);
    inputValue.setAttribute("class", "sensorInput");
    inputValue.setAttribute("autocomplete", "off");
    inputValue.addEventListener('change', () => {
        if (showLiveValue) {
            inputValue.value = formatEntityDisplay(extractEntityId(inputValue.value));
        }
        autoSave();
    });
    inputWrapper.appendChild(inputValue);

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'clearInputButton';
    clearButton.textContent = '×';
    clearButton.setAttribute('aria-label', 'Eingabe löschen');
    clearButton.addEventListener('click', () => {
        inputValue.value = '';
        inputValue.dispatchEvent(new Event('change'));
        inputValue.focus();
    });
    inputWrapper.appendChild(clearButton);

    const valueCell = document.createElement('td');
    valueCell.appendChild(inputWrapper);

    row.appendChild(keyCell);
    row.appendChild(valueCell);

    if (toggleChecked !== null && toggleChecked !== undefined) {
        const toggleCell = document.createElement('td');
        toggleCell.className = 'toggleCell';
        toggleCell.appendChild(buildToggleSwitch(key + ACTION_TOGGLE_POSTFIX, toggleChecked));
        row.appendChild(toggleCell);
    }
    return row;
}


const LIVE_VALUE_REFRESH_INTERVAL_MS = 30000;

async function refreshLiveSensorValues() {
    if (document.visibilityState !== 'visible') {
        return;
    }
    try {
        allSensorIdOptions = await getJson(sensorIdsUri);
    } catch (err) {
        console.log(err);
        return;
    }

    for (const section of INTEGRATION_SECTIONS) {
        for (const key of section.sensors) {
            const input = document.getElementById(key + VALUE_POSTFIX);
            // skip fields the user is currently typing in so we don't interrupt them
            if (!input || document.activeElement === input) {
                continue;
            }
            input.value = formatEntityDisplay(extractEntityId(input.value));
        }
    }
}

function formatShyftTime(ms) {
    if (!ms) return '';
    return new Date(ms).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'});
}

function formatShyftDayHeading(ms) {
    return new Date(ms).toLocaleDateString('de-DE', {day: 'numeric', month: 'long', year: 'numeric'});
}

function shyftDayKey(ms) {
    const date = new Date(ms || Date.now());
    return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
}

// Best-effort guess at the daily savings figure (sum of each action's "Savings" field) -
// not confirmed against shyft-power's own calculation, treat as approximate.
function formatShyftEuro(value) {
    const arrow = value < 0 ? '↘' : (value > 0 ? '↗' : '→');
    return arrow + ' ' + value.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' €';
}

function buildShyftActionCard(action) {
    const status = action['Status'] || '';
    const normalizedStatus = status.toLowerCase();
    const isActive = normalizedStatus.startsWith('aktiv');
    const isDeactivated = normalizedStatus.includes('deaktiviert');
    const baseStatus = status.replace(/\s*\(deaktiviert\)/i, '').trim();

    const card = document.createElement('div');
    card.className = 'shyftActionCard' + (isActive ? ' is-active' : '') + (isDeactivated ? ' is-deactivated' : '');

    const time = document.createElement('div');
    time.className = 'shyftActionTime';
    const startLine = document.createElement('div');
    startLine.textContent = formatShyftTime(action['Date Start']);
    const endLine = document.createElement('div');
    endLine.textContent = formatShyftTime(action['Date End']);
    time.appendChild(startLine);
    time.appendChild(endLine);
    card.appendChild(time);

    const iconUrl = getActionIconUrl(action['Action Name']);
    if (iconUrl) {
        const icon = document.createElement('img');
        icon.className = 'shyftActionIcon';
        icon.src = iconUrl;
        icon.alt = '';
        icon.loading = 'lazy';
        icon.addEventListener('error', () => { icon.style.display = 'none'; });
        card.appendChild(icon);
    }

    const main = document.createElement('div');
    main.className = 'shyftActionMain';
    const nameEl = document.createElement('div');
    nameEl.className = 'shyftActionName';
    nameEl.textContent = action['Action Name'] || '–';
    main.appendChild(nameEl);
    if (action['Subtitle']) {
        const subtitleEl = document.createElement('div');
        subtitleEl.className = 'shyftActionSubtitle';
        subtitleEl.textContent = action['Subtitle'];
        main.appendChild(subtitleEl);
    }
    if (action['Log']) {
        const logDetails = document.createElement('details');
        logDetails.className = 'shyftActionLog';
        const logSummary = document.createElement('summary');
        logSummary.textContent = 'Log anzeigen';
        logDetails.appendChild(logSummary);
        const logPre = document.createElement('pre');
        logPre.textContent = action['Log'];
        logDetails.appendChild(logPre);
        main.appendChild(logDetails);
    }
    card.appendChild(main);

    const statusEl = document.createElement('div');
    statusEl.className = 'shyftActionStatus';
    const statusMain = document.createElement('div');
    statusMain.textContent = baseStatus || '–';
    statusEl.appendChild(statusMain);
    if (isDeactivated) {
        const statusSub = document.createElement('div');
        statusSub.className = 'shyftActionStatusSub';
        statusSub.textContent = '(deaktiviert)';
        statusEl.appendChild(statusSub);
    }
    card.appendChild(statusEl);

    return card;
}

function renderShyftActions(container, actions) {
    container.innerHTML = '';

    if (actions.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'shyftActionsEmpty';
        empty.textContent = 'Es wurden in den letzten drei Tagen keine Aktionen berechnet.';
        container.appendChild(empty);
        return;
    }

    // sorted by Date End descending to match shyft-power's own ordering
    const sorted = [...actions].sort((a, b) => (b['Date End'] || 0) - (a['Date End'] || 0));

    const groups = new Map();
    for (const action of sorted) {
        const key = shyftDayKey(action['Date Start'] || action['Date End']);
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key).push(action);
    }

    for (const groupActions of groups.values()) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'shyftDayGroup';

        const heading = document.createElement('div');
        heading.className = 'shyftDayHeading';

        const dateLabel = document.createElement('span');
        dateLabel.className = 'shyftDayDate';
        dateLabel.textContent = formatShyftDayHeading(groupActions[0]['Date Start'] || groupActions[0]['Date End']);
        heading.appendChild(dateLabel);

        const savingsSum = groupActions.reduce((sum, a) => sum + (typeof a['Savings'] === 'number' ? a['Savings'] : 0), 0);
        const savingsLabel = document.createElement('span');
        savingsLabel.className = 'shyftDaySavings ' + (savingsSum < 0 ? 'negative' : 'positive');
        savingsLabel.textContent = formatShyftEuro(savingsSum);
        heading.appendChild(savingsLabel);

        dayDiv.appendChild(heading);

        for (const action of groupActions) {
            dayDiv.appendChild(buildShyftActionCard(action));
        }

        container.appendChild(dayDiv);
    }
}

async function loadShyftActions() {
    const container = document.getElementById('shyftActionsBody');
    if (!container) return;

    try {
        const result = await getJson(shyftActionsUri);
        if (result.status !== 'success') {
            showShyftActionsError(container);
            return;
        }
        const actions = (result.response && result.response.actions) || [];
        renderShyftActions(container, actions);
    } catch (err) {
        console.log(err);
        showShyftActionsError(container);
    }
}

function showShyftActionsError(container) {
    container.innerHTML = '';
    const error = document.createElement('div');
    error.className = 'shyftActionsError';
    error.textContent = 'Leider konnten keine Aktionen abgerufen werden, überprüfe die Verbindung zu shyft-power.';
    container.appendChild(error);
}

// "Heute: 3 kWh | Morgen: 23 kWh | Übermorgen: 22 kWh" - the remaining/full PV-Ertrag per
// Kalendertag (lokale Zeit), summiert aus den stündlichen kW-Werten (ein kW-Wert über eine Stunde
// ist per Definition eine kWh). "Heute" zählt nur noch nicht vergangene Stunden.
//
// Ein 48h-Fenster kann rechnerisch NIE alle 24 Kalenderstunden von "Übermorgen" enthalten (Heute
// + Morgen allein verbrauchen schon mindestens 24h davon) - "vollständig" heißt hier deshalb
// nicht "Mitternacht bis Mitternacht", sondern "die PV-Erzeugung ist erkennbar auf 0 gefallen":
// sobald ab PV_COMPLETE_CHECK_FROM_HOUR (17 Uhr - spätestens 21 Uhr wäre auch im Hochsommer sicher,
// im Winter geht die Sonne aber teils schon um 17 Uhr unter) ein Wert nahe 0 auftaucht, gilt der
// Tag als abgeschlossen; ein erneuter Anstieg danach ist im selben Kalendertag praktisch
// ausgeschlossen. "Morgen" bekommt dieselbe Prüfung (schadet nicht, greift im 48h-Fenster aber
// nie), nur "Heute" ist bewusst ausgenommen, da dort absichtlich nur die Teilsumme gezeigt wird.
function formatPvEnergySummary(labels, values) {
    const PV_ZERO_THRESHOLD_KW = 0.05;
    const PV_COMPLETE_CHECK_FROM_HOUR = 17;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentHourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
    const dayLabels = ['Heute', 'Morgen', 'Übermorgen'];
    const sums = [0, 0, 0];
    const hasData = [false, false, false];
    const reachedZeroInEvening = [false, false, false];

    for (let i = 0; i < labels.length; i++) {
        const d = new Date(labels[i]);
        const startOfThatDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const dayOffset = Math.round((startOfThatDay - startOfToday) / (24 * 60 * 60 * 1000));
        if (dayOffset < 0 || dayOffset > 2) continue;
        if (dayOffset === 0 && d < currentHourStart) continue; // schon vergangene Stunde
        sums[dayOffset] += values[i];
        hasData[dayOffset] = true;
        if (d.getHours() >= PV_COMPLETE_CHECK_FROM_HOUR && values[i] <= PV_ZERO_THRESHOLD_KW) {
            reachedZeroInEvening[dayOffset] = true;
        }
    }

    const parts = [];
    for (let offset = 0; offset < 3; offset++) {
        if (!hasData[offset]) continue;
        if (offset > 0 && !reachedZeroInEvening[offset]) continue;
        parts.push(`${dayLabels[offset]}: ${Math.round(sums[offset])} kWh`);
    }
    return parts.join(' | ');
}

// Renders one hourly time series as an interactive inline SVG line chart (no charting library).
// values/labels come straight from /dashboard/chart-data - labels are ISO timestamps this addon
// generated itself server-side (creation_date rounded down to the hour, +1h per row).
//
// options:
//   stepped     - draw a "step-after" path (each hourly value holds flat until the next hour,
//                 then jumps) instead of a straight line between points - for values that
//                 genuinely change once per hour (e.g. an hourly electricity price) rather than
//                 drifting smoothly, a straight line between points would misleadingly imply
//                 a gradual transition
//   colorBands  - {highThreshold, highColor, lowThreshold, lowColor, midColor} - colors each
//                 stepped segment by which band its (already valueScale-applied) value falls
//                 into, instead of a single accent color. Only meaningful together with stepped.
//   valueScale  - multiplier applied to every value before anything else (e.g. 100 to show a
//                 €/kWh price as Cent/kWh)
//   minY        - clamps the auto-computed lower axis bound (never shown lower than this) - e.g.
//                 0 for a value that's never actually negative (PV-Leistung)
//   fixedMin/
//   fixedMax    - pins the axis bound to this exact value instead of the auto-computed (padded)
//                 one, regardless of the data's actual range - e.g. 0/100 for a percentage that
//                 should always show its full possible range (Ladestand)
//   decimals    - digits shown in the hover/tap tooltip
function buildLineChart(title, unit, labels, values, options = {}) {
    const {stepped = false, colorBands = null, slopeBands = null, valueScale = 1, minY = null, fixedMin = null, fixedMax = null, decimals = 1, round = false, subtitle = '', presenceForecast = null} = options;
    const width = 600, height = 220;
    // presenceForecast reserves an extra strip just above the x-axis labels for the
    // Anwesenheitsprognose overlay bar (see below)
    const paddingLeft = 45, paddingRight = 15, paddingTop = 15, paddingBottom = presenceForecast ? 38 : 26;
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    const wrapper = document.createElement('div');
    wrapper.className = 'dashboardChart';
    const titleEl = document.createElement('div');
    titleEl.className = 'dashboardChartTitle';
    const parenthetical = [subtitle, unit].filter(Boolean).join(', ');
    titleEl.textContent = title + (parenthetical ? ` (${parenthetical})` : '');
    wrapper.appendChild(titleEl);

    if (presenceForecast) {
        const legend = document.createElement('div');
        legend.className = 'dashboardChartLegend';
        for (const [color, label] of [
            ['var(--color-accent)', 'eingesteckt'],
            ['var(--color-text-secondary)', 'steht'],
            ['var(--color-error)', 'unterwegs'],
        ]) {
            const item = document.createElement('span');
            item.className = 'dashboardChartLegendItem';
            const dot = document.createElement('span');
            dot.className = 'dashboardChartLegendDot';
            dot.style.background = color;
            item.appendChild(dot);
            item.appendChild(document.createTextNode(label));
            legend.appendChild(item);
        }
        wrapper.appendChild(legend);
    }

    if (!values || values.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'shyftActionsEmpty';
        empty.textContent = 'Keine Daten verfügbar.';
        wrapper.appendChild(empty);
        return wrapper;
    }

    let scaledValues = values.map(v => v * valueScale);
    if (round) scaledValues = scaledValues.map(Math.round);
    const rawMin = Math.min(...scaledValues);
    const rawMax = Math.max(...scaledValues);
    const valueRange = (rawMax - rawMin) || 1;
    let yMin = rawMin - valueRange * 0.1;
    let yMax = rawMax + valueRange * 0.1;
    if (minY !== null) yMin = Math.max(yMin, minY);
    if (fixedMin !== null) yMin = fixedMin;
    if (fixedMax !== null) yMax = fixedMax;
    const yRange = (yMax - yMin) || 1;
    const lastIndex = scaledValues.length - 1 || 1;

    const points = scaledValues.map((v, i) => [
        paddingLeft + (i / lastIndex) * plotWidth,
        paddingTop + plotHeight - ((v - yMin) / yRange) * plotHeight,
    ]);

    function colorForValue(v) {
        if (!colorBands) return 'var(--color-accent)';
        if (v >= colorBands.highThreshold) return colorBands.highColor;
        if (v <= colorBands.lowThreshold) return colorBands.lowColor;
        return colorBands.midColor;
    }

    // slope-based coloring (e.g. Warmwasser, Ladestand): colors a segment by how much the value
    // changed over it, rather than by its absolute level - rising is always "good" (riseColor),
    // a small drop is unremarkable (flatColor), a drop at or past bigDropThreshold is called out
    // (dropColor). Naturally a per-segment property, so it works for a smooth (non-stepped) line.
    function colorForSlope(v0, v1) {
        if (!slopeBands) return 'var(--color-accent)';
        const delta = v1 - v0;
        if (delta > 0) return slopeBands.riseColor;
        if (delta <= -(slopeBands.bigDropThreshold ?? 1)) return slopeBands.dropColor;
        return slopeBands.flatColor;
    }

    // A stepped segment's vertical "jump" connector can cross one or two colorBands thresholds
    // (e.g. 20 -> 31 crossing the 25 boundary) - splitting it into sub-segments at the exact
    // crossing point(s) keeps the connector's color matching what it's actually passing through,
    // instead of taking on a single (misleading) color for its whole length.
    function splitJumpByBands(v0, v1, y0, y1) {
        if (!colorBands || v0 === v1) return [{y0, y1, color: colorForValue(v1)}];
        const thresholds = [colorBands.lowThreshold, colorBands.highThreshold]
            .filter(t => t > Math.min(v0, v1) && t < Math.max(v0, v1))
            .sort((a, b) => (v0 < v1 ? a - b : b - a));
        const stops = [{v: v0, y: y0}, ...thresholds.map(t => ({v: t, y: y0 + (t - v0) / (v1 - v0) * (y1 - y0)})), {v: v1, y: y1}];
        const segments = [];
        for (let k = 0; k < stops.length - 1; k++) {
            segments.push({y0: stops[k].y, y1: stops[k + 1].y, color: colorForValue((stops[k].v + stops[k + 1].v) / 2)});
        }
        return segments;
    }

    const baseline = paddingTop + plotHeight;
    let lineMarkup, areaMarkup;
    if (stepped) {
        // one path per segment so each can be colored by its own (held-flat) value; the vertical
        // "jump" connecting two segments is split at any colorBands threshold it crosses (see
        // splitJumpByBands), or otherwise takes the color of the value it's leaving
        const lineParts = [], areaParts = [];
        for (let i = 0; i < points.length - 1; i++) {
            const color = colorBands ? colorForValue(scaledValues[i]) : colorForSlope(scaledValues[i], scaledValues[i + 1]);
            const [x0, y0] = points[i];
            const [x1] = points[i + 1];
            lineParts.push(`<path d="M${x0.toFixed(1)},${y0.toFixed(1)} L${x1.toFixed(1)},${y0.toFixed(1)}" fill="none" stroke="${color}" stroke-width="2" />`);
            areaParts.push(`<path d="M${x0.toFixed(1)},${baseline.toFixed(1)} L${x0.toFixed(1)},${y0.toFixed(1)} L${x1.toFixed(1)},${y0.toFixed(1)} L${x1.toFixed(1)},${baseline.toFixed(1)} Z" fill="${color}" opacity="0.15" stroke="none" />`);
            const [, yNext] = points[i + 1];
            if (colorBands) {
                for (const seg of splitJumpByBands(scaledValues[i], scaledValues[i + 1], y0, yNext)) {
                    lineParts.push(`<path d="M${x1.toFixed(1)},${seg.y0.toFixed(1)} L${x1.toFixed(1)},${seg.y1.toFixed(1)}" fill="none" stroke="${seg.color}" stroke-width="2" />`);
                }
            } else {
                lineParts.push(`<path d="M${x1.toFixed(1)},${y0.toFixed(1)} L${x1.toFixed(1)},${yNext.toFixed(1)}" fill="none" stroke="${color}" stroke-width="2" />`);
            }
        }
        lineMarkup = lineParts.join('');
        areaMarkup = areaParts.join('');
    } else if (slopeBands) {
        // one straight sub-path per segment, colored by that segment's own rise/fall
        const lineParts = [], areaParts = [];
        for (let i = 0; i < points.length - 1; i++) {
            const color = colorForSlope(scaledValues[i], scaledValues[i + 1]);
            const [x0, y0] = points[i];
            const [x1, y1] = points[i + 1];
            lineParts.push(`<path d="M${x0.toFixed(1)},${y0.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)}" fill="none" stroke="${color}" stroke-width="2" />`);
            areaParts.push(`<path d="M${x0.toFixed(1)},${baseline.toFixed(1)} L${x0.toFixed(1)},${y0.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)} L${x1.toFixed(1)},${baseline.toFixed(1)} Z" fill="${color}" opacity="0.15" stroke="none" />`);
        }
        lineMarkup = lineParts.join('');
        areaMarkup = areaParts.join('');
    } else {
        const color = colorForValue(scaledValues[0]);
        const linePath = points.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
        const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${baseline.toFixed(1)} L${points[0][0].toFixed(1)},${baseline.toFixed(1)} Z`;
        areaMarkup = `<path d="${areaPath}" fill="${color}" opacity="0.15" stroke="none" />`;
        lineMarkup = `<path d="${linePath}" fill="none" stroke="${color}" stroke-width="2" />`;
    }

    const tickCount = Math.min(6, labels.length);
    const tickIndices = [...new Set(Array.from({length: tickCount}, (_, i) => Math.round(i * lastIndex / (tickCount - 1 || 1))))];
    const xLabels = tickIndices.map(i => {
        const x = (paddingLeft + (i / lastIndex) * plotWidth).toFixed(1);
        const text = new Date(labels[i]).toLocaleString('de-DE', {weekday: 'short', hour: '2-digit'}).replace('.', '');
        return `<text x="${x}" y="${height - 6}" fill="var(--color-text-secondary)" text-anchor="middle">${text}</text>`;
    }).join('');

    const yTicks = [yMax, (yMin + yMax) / 2, yMin];
    const yLabels = yTicks.map(v => {
        const y = (paddingTop + plotHeight - ((v - yMin) / yRange) * plotHeight).toFixed(1);
        return `<text x="${paddingLeft - 8}" y="${(parseFloat(y) + 3).toFixed(1)}" fill="var(--color-text-secondary)" text-anchor="end">${round ? Math.round(v) : v.toFixed(1)}</text>`;
    }).join('');

    // vertical marker wherever the local calendar date changes between two consecutive hourly
    // points - shown on every chart so a day boundary is easy to spot regardless of which
    // variable is plotted
    let dayBoundaryMarkup = '';
    for (let i = 1; i < labels.length; i++) {
        const prevDate = new Date(labels[i - 1]);
        const curDate = new Date(labels[i]);
        if (curDate.getDate() !== prevDate.getDate()) {
            const x = (paddingLeft + (i / lastIndex) * plotWidth).toFixed(1);
            const dateText = curDate.toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit'});
            dayBoundaryMarkup += `<line x1="${x}" y1="${paddingTop}" x2="${x}" y2="${baseline.toFixed(1)}" stroke="var(--color-text-secondary)" stroke-width="1.5" stroke-dasharray="4,3" />`;
            dayBoundaryMarkup += `<text x="${x}" y="${paddingTop - 4}" fill="var(--color-text)" font-weight="700" text-anchor="middle">${dateText}</text>`;
        }
    }

    // Anwesenheitsprognose overlay: one cell per point in THIS chart's own x-scale (not the
    // forecast's own 48-point grid) - looked up by exact ISO-hour label match - so it stays
    // pixel-aligned with the SOC line above it instead of drawing a second, slightly-offset axis.
    // Cells with no matching forecast hour (out of the 48h window) are simply left blank. Each
    // cell shows the single MOST LIKELY of the three Zustände (eingesteckt/steht/unterwegs) in its
    // own color, opacity = that state's own probability - a proportional 3-way stacked bar would
    // be unreadable at this strip height (10px).
    let presenceMarkup = '';
    if (presenceForecast) {
        const barY = baseline + 6;
        const cellWidth = plotWidth / (points.length - 1 || 1);
        for (let i = 0; i < points.length; i++) {
            const byLabel = presenceForecast.byLabel[labels[i]];
            if (byLabel === undefined) continue;
            const states = [
                {p: byLabel.connected, color: 'var(--color-accent)'},
                {p: byLabel.standing, color: 'var(--color-text-secondary)'},
                {p: byLabel.driving, color: 'var(--color-error)'},
            ];
            const best = states.reduce((a, b) => (b.p > a.p ? b : a));
            const opacity = (0.1 + Math.max(0, Math.min(1, best.p)) * 0.8).toFixed(2);
            const x = (points[i][0] - cellWidth / 2).toFixed(1);
            presenceMarkup += `<rect x="${x}" y="${barY.toFixed(1)}" width="${cellWidth.toFixed(1)}" height="10" fill="${best.color}" opacity="${opacity}" />`;
        }
    }

    const chartContainer = document.createElement('div');
    chartContainer.className = 'dashboardChartContainer';
    chartContainer.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" class="dashboardChartSvg">
            <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${baseline.toFixed(1)}" stroke="var(--color-border)" />
            <line x1="${paddingLeft}" y1="${baseline.toFixed(1)}" x2="${width - paddingRight}" y2="${baseline.toFixed(1)}" stroke="var(--color-border)" />
            ${areaMarkup}
            ${lineMarkup}
            ${presenceMarkup}
            ${dayBoundaryMarkup}
            ${yLabels}
            ${xLabels}
        </svg>`;
    wrapper.appendChild(chartContainer);

    const tooltip = document.createElement('div');
    tooltip.className = 'dashboardChartTooltip';
    tooltip.hidden = true;
    chartContainer.appendChild(tooltip);

    const svgEl = chartContainer.querySelector('svg');

    function showTooltip(clientX) {
        const rect = svgEl.getBoundingClientRect();
        if (rect.width === 0) return;
        const scale = rect.width / width;
        const svgX = (clientX - rect.left) / scale;
        const idx = Math.max(0, Math.min(lastIndex, Math.round((svgX - paddingLeft) / plotWidth * lastIndex)));
        const d = new Date(labels[idx]);
        const dateText = d.toLocaleString('de-DE', {weekday: 'short', hour: '2-digit', minute: '2-digit'}).replace('.', '');
        tooltip.textContent = `${dateText}: ${scaledValues[idx].toFixed(decimals)}${unit ? ' ' + unit : ''}`;
        tooltip.style.left = (points[idx][0] * scale).toFixed(1) + 'px';
        tooltip.style.top = (points[idx][1] * scale).toFixed(1) + 'px';
        tooltip.hidden = false;
    }

    svgEl.addEventListener('mousemove', e => showTooltip(e.clientX));
    svgEl.addEventListener('mouseleave', () => { tooltip.hidden = true; });
    svgEl.addEventListener('touchstart', e => { if (e.touches[0]) showTooltip(e.touches[0].clientX); }, {passive: true});
    svgEl.addEventListener('touchmove', e => { if (e.touches[0]) showTooltip(e.touches[0].clientX); }, {passive: true});

    return wrapper;
}

// Einfacher, aufklappbarer Zahlenvektor der für die nächsten 48h prognostizierten Verbräuche
// (kWh) - erstmal ohne eigenes Diagramm, bis die input.csv-Erzeugung selbst ins Addon wandert.
function buildCarConsumptionForecastDetails(labels, consumptionKwh, lowDataBasis) {
    const details = document.createElement('details');
    details.className = 'dashboardConsumptionForecast';
    const summary = document.createElement('summary');
    summary.textContent = 'Verbrauchsprognose (48h) anzeigen';
    details.appendChild(summary);
    const lowCount = (lowDataBasis || []).filter(Boolean).length;
    if (lowCount > 0) {
        const note = document.createElement('p');
        note.className = 'shyftActionsError';
        note.textContent = `⚠ ${lowCount} von ${labels.length} Stunden (markiert mit ~) basieren auf wenig Datenbasis (Cold-Start oder wenig Historie) - Werte dort sind noch unsicher.`;
        details.appendChild(note);
    }
    const pre = document.createElement('pre');
    pre.textContent = labels.map((label, i) => {
        const timeText = new Date(label).toLocaleString('de-DE', {weekday: 'short', hour: '2-digit', minute: '2-digit'}).replace('.', '');
        const marker = (lowDataBasis && lowDataBasis[i]) ? '~' : ' ';
        return `${marker}${timeText}: ${consumptionKwh[i].toFixed(2)} kWh`;
    }).join('\n');
    details.appendChild(pre);
    return details;
}

// ============================================================================
// Energiefluss-Widget: live-animierte Haus-Grafik oben auf dem Dashboard (siehe
// GET /dashboard/energy-flow, compute_energy_flow_data in app.py). Alle Icons sind selbst
// gezeichnete, einfache Flat-Shapes (Pfade/Formen direkt hier im Code) statt externer Grafiken -
// lizenzfrei per Konstruktion. Zeigt jedes Geraet nur, wenn es tatsaechlich als Integration
// ausgewaehlt ist (data.<gerät>.configured).
// ============================================================================

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}, children = []) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (value !== undefined && value !== null) el.setAttribute(key, value);
    }
    for (const child of children) {
        if (child) el.appendChild(child);
    }
    return el;
}

function formatKwValue(kw) {
    if (kw === null || kw === undefined) return '–';
    return kw.toLocaleString('de-DE', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + ' kW';
}

// Animationsdauer einer Flusslinie: schneller/kuerzere Dauer bei hoeherer Leistung, aber nie
// komplett angehalten - auch bei 0 kW (bzw. beim Haushaltsstrom, siehe compute_energy_flow_data's
// residualKw) bewegt sich die Linie noch leicht, wie gewuenscht ("ständig einen leichten
// Stromverbrauch simulieren").
function flowAnimationDuration(kw) {
    const absKw = Math.min(Math.abs(kw || 0), 3);
    const minDuration = 0.6, maxDuration = 3.2;
    return maxDuration - (absKw / 3) * (maxDuration - minDuration);
}

// Gerade Linie (Netz/Batterie) oder eine Spine-mit-Abzweigung (rechte Spalte: erst waagerecht bis
// zur Spalten-x, dann senkrecht zur Ziel-Reihe) - je nach dem, ob y1 und y2 gleich sind.
function buildFlowPath(x1, y1, x2, y2) {
    if (y1 === y2) return `M ${x1},${y1} L ${x2},${y2}`;
    return `M ${x1},${y1} H ${x2} V ${y2}`;
}

function buildFlowLine(x1, y1, x2, y2, kw, {reversed = false, colorVar = 'var(--color-accent)'} = {}) {
    if (kw === null || kw === undefined) return null;
    const path = svgEl('path', {
        d: buildFlowPath(x1, y1, x2, y2),
        class: 'energyFlowLine' + (reversed ? ' energyFlowLine-reverse' : ''),
        stroke: colorVar,
        fill: 'none',
    });
    path.style.animationDuration = flowAnimationDuration(kw) + 's';
    return path;
}

function buildHouseIcon(cx, cy, {withSolar} = {}) {
    const wallW = 100, wallH = 66, roofRise = 58, roofOverhang = 12;
    const wallX = cx - wallW / 2, wallY = cy - wallH / 2;
    const roofLeftX = wallX - roofOverhang, roofRightX = wallX + wallW + roofOverhang;
    const apexX = cx, apexY = wallY - roofRise;
    const g = svgEl('g', {class: 'energyFlowHouse'});
    g.appendChild(svgEl('polygon', {
        points: `${roofLeftX},${wallY} ${apexX},${apexY} ${roofRightX},${wallY}`,
        fill: 'var(--color-text)',
    }));
    g.appendChild(svgEl('rect', {
        x: wallX, y: wallY, width: wallW, height: wallH,
        fill: 'var(--color-bg-card)', stroke: 'var(--color-border)', 'stroke-width': 2,
    }));
    g.appendChild(svgEl('rect', {
        x: cx - 10, y: wallY + wallH - 28, width: 20, height: 28, fill: 'var(--color-text-secondary)',
    }));
    if (withSolar) {
        const slopeSteps = 4;
        const angleDeg = Math.atan2(roofLeftX - apexX, wallY - apexY) * 180 / Math.PI;
        for (let i = 1; i <= slopeSteps; i++) {
            const t = i / (slopeSteps + 1);
            const px = apexX + t * (roofLeftX - apexX);
            const py = apexY + t * (wallY - apexY);
            g.appendChild(svgEl('rect', {
                x: px - 8, y: py - 4, width: 15, height: 8,
                fill: '#1c3d6b', stroke: '#0a1f3d', 'stroke-width': 0.6,
                transform: `rotate(${angleDeg} ${px} ${py})`,
            }));
        }
    }
    return g;
}

function buildPylonIcon(cx, cy) {
    const g = svgEl('g', {stroke: 'var(--color-text-secondary)', 'stroke-width': 2.5, fill: 'none', 'stroke-linecap': 'round'});
    g.appendChild(svgEl('path', {d: `M ${cx - 22},${cy + 40} L ${cx},${cy - 40} L ${cx + 22},${cy + 40}`}));
    g.appendChild(svgEl('path', {d: `M ${cx - 14},${cy + 40} L ${cx + 14},${cy - 4} M ${cx + 14},${cy + 40} L ${cx - 14},${cy - 4}`}));
    for (const yOff of [-30, -10, 12]) {
        g.appendChild(svgEl('line', {x1: cx - (22 * (1 - (yOff + 40) / 80)), y1: cy + yOff, x2: cx + (22 * (1 - (yOff + 40) / 80)), y2: cy + yOff}));
    }
    return g;
}

function buildBatteryIcon(cx, cy, socPercent) {
    const w = 44, h = 64;
    const x = cx - w / 2, y = cy - h / 2;
    const g = svgEl('g');
    g.appendChild(svgEl('rect', {x: cx - 10, y: y - 8, width: 20, height: 8, fill: 'var(--color-text-secondary)'}));
    g.appendChild(svgEl('rect', {x, y, width: w, height: h, rx: 6, fill: 'var(--color-bg-card)', stroke: 'var(--color-text-secondary)', 'stroke-width': 2.5}));
    const soc = Math.max(0, Math.min(100, socPercent ?? 0));
    const fillH = (h - 8) * (soc / 100);
    g.appendChild(svgEl('rect', {
        x: x + 4, y: y + h - 4 - fillH, width: w - 8, height: fillH, rx: 3,
        fill: soc < 20 ? 'var(--color-error)' : 'var(--color-accent)',
    }));
    return g;
}

function buildHeatpumpIcon(cx, cy, on) {
    const g = svgEl('g');
    g.appendChild(svgEl('rect', {x: cx - 26, y: cy - 22, width: 52, height: 44, rx: 6, fill: 'var(--color-bg-card)', stroke: 'var(--color-border)', 'stroke-width': 2}));
    const fan = svgEl('g', {class: 'energyFlowFan' + (on ? ' spinning' : '')});
    for (const angle of [0, 90, 180, 270]) {
        fan.appendChild(svgEl('ellipse', {
            cx: cx, cy: cy, rx: 3, ry: 12, fill: on ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            transform: `rotate(${angle + 45} ${cx} ${cy})`,
        }));
    }
    fan.appendChild(svgEl('circle', {cx, cy, r: 4, fill: 'var(--color-text)'}));
    g.appendChild(fan);
    return g;
}

function buildCarIcon(cx, cy, faded) {
    const g = svgEl('g', {opacity: faded ? 0.35 : 1});
    g.appendChild(svgEl('rect', {x: cx - 26, y: cy - 6, width: 52, height: 16, rx: 6, fill: 'var(--color-error)'}));
    g.appendChild(svgEl('path', {d: `M ${cx - 16},${cy - 6} L ${cx - 10},${cy - 16} L ${cx + 12},${cy - 16} L ${cx + 18},${cy - 6} Z`, fill: 'var(--color-error)'}));
    for (const dx of [-14, 14]) {
        g.appendChild(svgEl('circle', {cx: cx + dx, cy: cy + 11, r: 6, fill: 'var(--color-text)'}));
    }
    return g;
}

function buildPlugIcon(cx, cy, on) {
    const color = on ? 'var(--color-accent)' : 'var(--color-text-secondary)';
    const g = svgEl('g', {opacity: on ? 1 : 0.4});
    g.appendChild(svgEl('rect', {x: cx - 10, y: cy - 14, width: 20, height: 22, rx: 4, fill: 'none', stroke: color, 'stroke-width': 2.5}));
    g.appendChild(svgEl('line', {x1: cx - 4, y1: cy - 14, x2: cx - 4, y2: cy - 20, stroke: color, 'stroke-width': 2.5, 'stroke-linecap': 'round'}));
    g.appendChild(svgEl('line', {x1: cx + 4, y1: cy - 14, x2: cx + 4, y2: cy - 20, stroke: color, 'stroke-width': 2.5, 'stroke-linecap': 'round'}));
    g.appendChild(svgEl('line', {x1: cx, y1: cy + 8, x2: cx, y2: cy + 16, stroke: color, 'stroke-width': 2.5, 'stroke-linecap': 'round'}));
    return g;
}

function buildLightningIcon(cx, cy) {
    return svgEl('path', {
        d: `M ${cx - 4},${cy - 12} L ${cx - 10},${cy + 2} L ${cx - 2},${cy + 2} L ${cx - 6},${cy + 14} L ${cx + 10},${cy - 3} L ${cx + 2},${cy - 3} Z`,
        fill: 'var(--color-accent)',
    });
}

// Reiner Tag/Nacht-Indikator nach lokaler Uhrzeit - Platzhalter, bis ein Mapping von shyft's
// Wetterdaten auf Icons vorliegt (dann ersetzt diese Funktion, der Rest des Widgets bleibt gleich).
function renderSkyIcon(cx, cy) {
    const hour = new Date().getHours();
    const isDaytime = hour >= 6 && hour < 20;
    const g = svgEl('g');
    if (isDaytime) {
        g.appendChild(svgEl('circle', {cx, cy, r: 14, fill: '#f4c542'}));
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * 2 * Math.PI;
            const x1 = cx + Math.cos(angle) * 19, y1 = cy + Math.sin(angle) * 19;
            const x2 = cx + Math.cos(angle) * 25, y2 = cy + Math.sin(angle) * 25;
            g.appendChild(svgEl('line', {x1, y1, x2, y2, stroke: '#f4c542', 'stroke-width': 2.5, 'stroke-linecap': 'round'}));
        }
    } else {
        g.appendChild(svgEl('path', {
            d: `M ${cx + 8},${cy - 14} A 14 14 0 1 0 ${cx + 8},${cy + 14} A 11 11 0 1 1 ${cx + 8},${cy - 14} Z`,
            fill: '#c9d3e8',
        }));
        for (const [dx, dy] of [[22, -10], [28, 4], [18, 12]]) {
            g.appendChild(svgEl('circle', {cx: cx + dx, cy: cy + dy, r: 1.4, fill: '#c9d3e8'}));
        }
    }
    return g;
}

function buildEnergyFlowLabel(x, y, lines, {anchor = 'start'} = {}) {
    const text = svgEl('text', {x, y, 'text-anchor': anchor, class: 'energyFlowLabel'});
    lines.forEach((line, i) => {
        text.appendChild(svgEl('tspan', {x, dy: i === 0 ? 0 : 14}, [document.createTextNode(line)]));
    });
    return text;
}

function buildEnergyFlowWidget(data) {
    const wrapper = document.createElement('div');
    wrapper.className = 'energyFlowWidget dashboardChart';
    const svg = svgEl('svg', {viewBox: '0 0 920 480'});

    const houseCx = 300, houseCy = 230;
    svg.appendChild(renderSkyIcon(850, 45));

    if (data.grid && data.grid.configured) {
        const line = buildFlowLine(132, houseCy, 246, houseCy, data.grid.kw, {reversed: (data.grid.kw || 0) < 0});
        if (line) svg.appendChild(line);
        svg.appendChild(buildPylonIcon(90, houseCy));
        const priceColor = data.grid.priceLevel === 'hoch' ? 'var(--color-error)' : data.grid.priceLevel === 'niedrig' ? 'var(--color-accent)' : 'var(--color-text-secondary)';
        const priceText = data.grid.priceCent !== null ? `${data.grid.priceCent.toLocaleString('de-DE')} Cent` : '';
        const label = buildEnergyFlowLabel(90, 300, [formatKwValue(data.grid.kw)], {anchor: 'middle'});
        svg.appendChild(label);
        if (priceText) {
            const priceLabel = svgEl('text', {x: 90, y: 318, 'text-anchor': 'middle', class: 'energyFlowLabel', fill: priceColor}, [document.createTextNode(priceText)]);
            svg.appendChild(priceLabel);
        }
    }

    svg.appendChild(buildHouseIcon(houseCx, houseCy, {withSolar: data.pv && data.pv.configured}));
    if (data.pv && data.pv.configured) {
        const line = buildFlowLine(houseCx, 148, houseCx, 197, data.pv.kw);
        if (line) svg.appendChild(line);
        svg.appendChild(buildEnergyFlowLabel(houseCx, 128, [formatKwValue(data.pv.kw)], {anchor: 'middle'}));
    }
    if (data.household && data.household.configured) {
        svg.appendChild(buildEnergyFlowLabel(houseCx + 66, houseCy + 4, [formatKwValue(data.household.kw)]));
    }

    if (data.battery && data.battery.configured) {
        const batteryCy = 400;
        const line = buildFlowLine(houseCx, houseCy + 33, houseCx, batteryCy - 40, data.battery.kw, {reversed: (data.battery.kw || 0) < 0});
        if (line) svg.appendChild(line);
        svg.appendChild(buildBatteryIcon(houseCx, batteryCy, data.battery.soc));
        const modeLine = data.battery.mode ? [`${Math.round(data.battery.soc ?? 0)} %`, data.battery.mode] : [`${Math.round(data.battery.soc ?? 0)} %`];
        svg.appendChild(buildEnergyFlowLabel(houseCx + 34, batteryCy - 4, [formatKwValue(data.battery.kw), ...modeLine], {anchor: 'start'}));
    }

    const columnX = 700;
    const houseRightX = houseCx + 62;

    if (data.heatpump && data.heatpump.configured) {
        const rowY = 100;
        const line = buildFlowLine(houseRightX, houseCy - 20, columnX - 40, rowY, data.heatpump.kw);
        if (line) svg.appendChild(line);
        svg.appendChild(buildHeatpumpIcon(columnX, rowY, data.heatpump.on));
        const statusLines = [
            data.heatpump.on === null ? 'Wärmepumpe' : (data.heatpump.on ? 'An' : 'Aus'),
            data.heatpump.targetTempC !== null ? `Soll: ${data.heatpump.targetTempC.toLocaleString('de-DE')} °C` : null,
            data.indoorTemp && data.indoorTemp.configured && data.indoorTemp.tempC !== null ? `Ist: ${data.indoorTemp.tempC.toLocaleString('de-DE')} °C` : null,
            data.heatpump.dhwTankTempC !== null ? `WW-Speicher: ${data.heatpump.dhwTankTempC.toLocaleString('de-DE')} °C` : null,
            (data.heatpump.heatingOn !== null || data.heatpump.supplyTempC !== null)
                ? `Heizung: ${data.heatpump.heatingOn ? 'An' : 'Aus'}` + (data.heatpump.supplyTempC !== null ? ` (${data.heatpump.supplyTempC.toLocaleString('de-DE')} °C)` : '')
                : null,
        ].filter(Boolean);
        svg.appendChild(buildEnergyFlowLabel(columnX + 36, rowY - 14, statusLines));
    }

    if (data.car && data.car.configured) {
        const rowY = 220;
        const isAway = data.car.state === 'away';
        const isCharging = data.car.state === 'charging';
        if (isCharging) {
            // laedt: animierte Linie mit der tatsaechlichen Ladeleistung (Platzhalter 0.5 kW nur,
            // falls die Wallbox-Ladeleistung selbst nicht zugeordnet/lesbar ist)
            const line = buildFlowLine(houseRightX, houseCy, columnX - 40, rowY, data.car.chargingKw || 0.5);
            if (line) svg.appendChild(line);
        } else if (!isAway && data.car.state !== null) {
            // eingesteckt, aber laedt gerade nicht: ruhige, unbewegte Verbindungslinie statt der animierten Flusslinie
            svg.appendChild(svgEl('path', {d: buildFlowPath(houseRightX, houseCy, columnX - 40, rowY), stroke: 'var(--color-border)', 'stroke-width': 2, fill: 'none'}));
        }
        svg.appendChild(buildCarIcon(columnX, rowY, isAway));
        const carLines = [];
        if (data.car.soc !== null) carLines.push(`${Math.round(data.car.soc)} %` + (data.car.rangeKm !== null ? ` (${data.car.rangeKm} km)` : ''));
        if (data.car.state === 'away') carLines.push('abwesend');
        else if (data.car.state === 'charging') carLines.push('lädt');
        else if (data.car.state === 'connected') carLines.push('eingesteckt');
        svg.appendChild(buildEnergyFlowLabel(columnX + 36, rowY - 4, carLines));
    }

    if (data.sonstigerVerbraucher && data.sonstigerVerbraucher.configured) {
        const rowY = 340;
        const on = !!data.sonstigerVerbraucher.on;
        if (on) {
            // kein Leistungssensor fuer "Sonstiger Verbraucher" vorgesehen (nur an/aus) - fester
            // Platzhalterwert nur fuer eine plausible Animationsgeschwindigkeit, keine echte Messung
            const line = buildFlowLine(houseRightX, houseCy + 20, columnX - 40, rowY, 0.3);
            if (line) svg.appendChild(line);
        }
        svg.appendChild(buildPlugIcon(columnX, rowY, on));
        svg.appendChild(buildEnergyFlowLabel(columnX + 26, rowY + 4, ['Sonstiges Gerät']));
    }

    if (data.household && data.household.configured) {
        const rowY = 430;
        const line = buildFlowLine(houseRightX, houseCy + 30, columnX - 40, rowY, data.household.residualKw ?? 0.1);
        if (line) svg.appendChild(line);
        svg.appendChild(buildLightningIcon(columnX, rowY));
        svg.appendChild(buildEnergyFlowLabel(columnX + 24, rowY + 4, ['Haushaltsstrom']));
    }

    wrapper.appendChild(svg);
    return wrapper;
}

async function loadDashboard() {
    const container = document.getElementById('dashboardBody');
    if (!container) return;
    try {
        const data = await getJson(insideHomeAssistant + '/dashboard/chart-data');
        if (data.status !== 'success') {
            container.innerHTML = '';
            const error = document.createElement('p');
            error.className = 'shyftActionsError';
            error.textContent = data.message || 'Diagrammdaten konnten nicht geladen werden.';
            container.appendChild(error);
            return;
        }
        container.innerHTML = '';
        try {
            const flowData = await getJson(insideHomeAssistant + '/dashboard/energy-flow');
            container.appendChild(buildEnergyFlowWidget(flowData));
        } catch (err) {
            // best-effort: ein fehlgeschlagenes Energiefluss-Widget darf die restlichen Charts nicht verhindern
            console.log(err);
        }
        container.appendChild(buildLineChart('Strompreis', 'Cent/kWh', data.labels, data.p_buy, {
            subtitle: 'Bezug',
            stepped: true,
            valueScale: 100,
            decimals: 0,
            colorBands: {highThreshold: 35, highColor: 'var(--color-error)', lowThreshold: 25, lowColor: 'var(--color-accent)', midColor: 'var(--color-text-secondary)'},
        }));
        container.appendChild(buildLineChart('Außentemperatur', '°C', data.labels, data.temperature));
        container.appendChild(buildLineChart('PV-Leistung', 'kW', data.labels, data.pv_generation, {minY: 0}));
        const pvEnergySummaryText = formatPvEnergySummary(data.labels, data.pv_generation);
        if (pvEnergySummaryText) {
            const pvEnergySummary = document.createElement('div');
            pvEnergySummary.className = 'dashboardPvEnergySummary';
            pvEnergySummary.textContent = pvEnergySummaryText;
            container.appendChild(pvEnergySummary);
        }
        container.appendChild(buildLineChart('Raumtemperatur', '°C', data.output_labels, data.t_i_target, {
            subtitle: 'Ziel',
            stepped: true,
            round: true,
            decimals: 0,
        }));
        container.appendChild(buildLineChart('Warmwasser', '°C', data.output_labels, data.t_hw, {
            slopeBands: {riseColor: 'var(--color-accent)', dropColor: 'var(--color-error)', flatColor: 'var(--color-text-secondary)', bigDropThreshold: 1},
        }));
        container.appendChild(buildLineChart('Ladestand Heimspeicher', '%', data.output_labels, data.soc_b, {
            fixedMin: 0,
            fixedMax: 100,
            slopeBands: {riseColor: 'var(--color-accent)', dropColor: 'var(--color-error)', flatColor: 'var(--color-text-secondary)', bigDropThreshold: 0.1},
        }));
        // best-effort: a missing/failed Anwesenheitsprognose (e.g. no wallbox-Status-Zuordnung
        // gepflegt, oder noch keine Historie vorhanden) just means the chart renders without the
        // overlay bar, not that the whole Dashboard-tab fails
        let presenceForecast = null;
        let consumptionForecast = null;
        try {
            const presenceData = await getJson(insideHomeAssistant + '/dashboard/car-presence-forecast');
            if (presenceData.status === 'success') {
                const byLabel = {};
                presenceData.labels.forEach((label, i) => {
                    byLabel[label] = {
                        connected: presenceData.probabilities[i],
                        standing: presenceData.standingProbabilities[i],
                        driving: presenceData.drivingProbabilities[i],
                    };
                });
                presenceForecast = {byLabel};
                consumptionForecast = {labels: presenceData.labels, consumptionKwh: presenceData.consumptionKwh, lowDataBasis: presenceData.lowDataBasis};
            }
        } catch (err) {
            console.log(err);
        }
        container.appendChild(buildLineChart('Ladestand Auto', '%', data.output_labels, data.soc_ev, {
            fixedMin: 0,
            fixedMax: 100,
            valueScale: 100,
            slopeBands: {riseColor: 'var(--color-accent)', dropColor: 'var(--color-error)', flatColor: 'var(--color-text-secondary)', bigDropThreshold: 0.1},
            presenceForecast,
        }));
        if (consumptionForecast) {
            container.appendChild(buildCarConsumptionForecastDetails(consumptionForecast.labels, consumptionForecast.consumptionKwh, consumptionForecast.lowDataBasis));
        }
    } catch (err) {
        console.log(err);
        container.innerHTML = '';
        const error = document.createElement('p');
        error.className = 'shyftActionsError';
        error.textContent = 'Diagrammdaten konnten nicht geladen werden.';
        container.appendChild(error);
    }
}

function setupTabs() {
    const buttons = document.querySelectorAll('.tabButton');
    for (const button of buttons) {
        button.addEventListener('click', () => {
            for (const b of buttons) {
                b.classList.remove('active');
            }
            button.classList.add('active');
            for (const panel of document.querySelectorAll('.tabPanel')) {
                panel.classList.remove('active');
            }
            document.getElementById('tab-' + button.dataset.tab).classList.add('active');
        });
    }
}

// loadShyftActions waits for loadConfiguration so the action cards' brand icons (getActionIconUrl)
// have integrationsData/currentIntegrationSelections available on the very first render
if (document.readyState === 'complete') {
    loadConfiguration().then(loadShyftActions);
    loadDashboard();
    setupTabs();
} else {
    window.addEventListener('load', () => {
        loadConfiguration().then(loadShyftActions);
        loadDashboard();
        setupTabs();
    });
}

setInterval(refreshLiveSensorValues, LIVE_VALUE_REFRESH_INTERVAL_MS);
