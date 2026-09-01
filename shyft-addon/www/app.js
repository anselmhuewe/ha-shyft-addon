const outsideHomeAssistant = "http://localhost:8000/0";
const insideHomeAssistant = window.location.pathname;
const configUri = insideHomeAssistant + "/config";
const sensorIdsUri = insideHomeAssistant + "/sensorids";
const integrationsUri = insideHomeAssistant + "/integrations";
const shyftActionsUri = insideHomeAssistant + "/shyft/actions";
const notificationTargetsUri = insideHomeAssistant + "/notification-targets";
const servicesUri = insideHomeAssistant + "/services";
const systemHealthUri = insideHomeAssistant + "/system-health";
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
    'photovoltaic_powerflow_pv': {type: 'power_unit'},
    'photovoltaic_powerflow_load': {type: 'power_unit'},
    'photovoltaic_powerflow_grid': {type: 'power_unit'},
    'photovoltaic_powerflow_battery': {type: 'power_unit'},
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
    'sonstiger_verbraucher_switch_entity': {type: 'state_on_off'},
}

// Synthetischer integrationMappings-Eintrag (["demo"]) statt einer echten HA-Integration - siehe
// DEMO_CAPABLE_SECTIONS/DEMO_INTEGRATION_ID in app.py, DEMO_SECTION_SENSORS in sync_service.py.
// Zeigt plausible Beispieldaten, bis der Nutzer ein echtes Geraet hinterlegt - dieser Moment loest
// dann serverseitig automatisch die Anlage eines echten shyft-power-Accounts aus (siehe
// maybe_create_real_account in app.py), ganz ohne Popup/E-Mail-Abfrage.
const DEMO_INTEGRATION_ID = 'demo';

const INTEGRATION_SECTIONS = [
    {
        key: 'wechselrichter',
        label: 'Wechselrichter',
        sensors: ['photovoltaic_powerflow_pv', 'photovoltaic_powerflow_load', 'photovoltaic_powerflow_grid', 'photovoltaic_powerflow_battery'],
        actions: ['pv_feed_in_limit', 'consumption_limit_14a'],
        requiresDeviceClass: 'power',
        hasDemo: true
    },
    {
        key: 'batterie',
        label: 'Batterie',
        sensors: ['battery_storage_command_mode', 'battery_state_of_charge', 'battery_charge_limit_current', 'battery_discharge_limit_current'],
        actions: ['battery_charge_shift_pv_surplus', 'battery_discharge_shift', 'battery_grid_charge', 'battery_action_stop'],
        requiresDeviceClass: 'power',
        hasDemo: true
    },
    {
        key: 'waermepumpe',
        label: 'Wärmepumpe',
        sensors: ['heatpump_dhw_tank_temp', 'heatpump_dhw_activated', 'heatpump_dhw_on_off', 'heatpump_heating_target_temp_normal', 'heatpump_heating_activated', 'heatpump_current_power_elect', 'heatpump_on_off', 'heatpump_supply_temp_hp'],
        actions: ['hot_water', 'heating_target_temp'],
        requiresDeviceClass: 'temperature',
        hasDemo: true
    },
    {
        key: 'auto',
        label: 'Auto',
        sensors: ['electronicvehicle_state_of_charge'],
        actions: [],
        hasDemo: true
    },
    {
        key: 'wallbox',
        label: 'Wallbox',
        sensors: ['wallbox_current_charging_power', 'wallbox_plugged'],
        actions: ['car_charge_start', 'car_charge_stop'],
        hasDemo: true
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
    // Reine Steuerungen ohne Sensor-Gegenstueck (kein sensorField, keine "Direkt steuern"-Option) -
    // siehe automationOnly in buildAutoManagedNumberControl.
    {key: 'pv_feed_in_limit', type: 'number', actionKeys: ['pv_feed_in_limit'], titleLabel: 'PV: Einspeisung begrenzen', unit: '', step: 1, automationOnly: true},
    {key: 'consumption_limit_14a', type: 'number', actionKeys: ['consumption_limit_14a'], titleLabel: 'Verbrauch begrenzen §14a', unit: '', step: 1, automationOnly: true},
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
        "wallboxMaxPhases": configData["wallboxMaxPhases"] ?? 3,
        "wallboxMaxCurrentAmps": configData["wallboxMaxCurrentAmps"] ?? 16,
        "batteryFlowSignOverride": configData["batteryFlowSignOverride"] ?? null,
        "evSocNormal": configData["evSocNormal"] ?? null,
        "evSocMaxPvSurplus": configData["evSocMaxPvSurplus"] ?? null,
        // Bis 0.0.44.33 fehlten alle uebrigen "einfachen" staticConfig-Felder (Waermepumpe/Batterie/
        // Strompreise/Optimierung) hier komplett - sie wurden per change-Handler nur lokal in
        // configData gesetzt, aber nie tatsaechlich per PUT mitgeschickt. writeConfig in app.py
        // uebernimmt nur Keys, die im PUT-Body stehen (data.update(incoming)) - die Auswahl ging
        // also bei jedem naechsten Speichern wieder verloren. Default-Werte hier spiegeln exakt die
        // defaultValue der jeweiligen buildXyzField-Funktion oben.
        "hpType": configData["hpType"] ?? 'Air-Water',
        "hpBuildingSize": configData["hpBuildingSize"] ?? '130 m²',
        "hpEnergyEfficiency": configData["hpEnergyEfficiency"] ?? 'C (90 kWh/a/m²)',
        "hpDhwTankSize": configData["hpDhwTankSize"] ?? 'klein (200 Liter)',
        "hpMaxPower": configData["hpMaxPower"] ?? 'mittel (6 kW)',
        "hpMaxSupplyTempC": configData["hpMaxSupplyTempC"] ?? 55,
        "hpHeatingBuffer": configData["hpHeatingBuffer"] ?? 'mittel__0.2',
        "hpHeatingCurveLevel": configData["hpHeatingCurveLevel"] ?? 0,
        "hpHeatingCurveSlope": configData["hpHeatingCurveSlope"] ?? 1.2,
        "batteryCapacityKwh": configData["batteryCapacityKwh"] ?? 10,
        "batterySocMinPercent": configData["batterySocMinPercent"] ?? 10,
        "coPriceGas": configData["coPriceGas"] ?? 0.1,
        "optimizationPeriodsSite": configData["optimizationPeriodsSite"] ?? 48,
        "electricityBaseLoad": configData["electricityBaseLoad"] ?? 'niedrig__2628',
        "electricityPriceBuy": configData["electricityPriceBuy"] ?? 'mittel (30 Cent)',
        "electricityPriceSell": configData["electricityPriceSell"] ?? 'mittel (10 Cent)'
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

// Nutzer-sichtbare Fehler-/Statuskarte ganz oben auf der Konfigurationsseite: entweder
// "Alle Systeme laufen" (dezent gruen) oder bis zu 5 laufende Probleme in Klartext.
// Datenquelle ist /system-health (problem_registry.py serverseitig) - eine Problem-ID wird
// vom jeweiligen Code-Pfad selbst wieder freigegeben, sobald er wieder erfolgreich laeuft.
async function renderSystemHealth() {
    const container = document.getElementById('systemHealthCard');
    if (!container) return;
    let health;
    try {
        health = await getJson(systemHealthUri);
    } catch (err) {
        console.log(err);
        return;
    }
    container.innerHTML = '';
    if (health.ok) {
        container.className = 'systemHealthCard is-ok';
        const icon = document.createElement('span');
        icon.className = 'systemHealthCardIcon';
        icon.textContent = '✓';
        container.appendChild(icon);
        const text = document.createElement('span');
        text.textContent = 'Alle Systeme laufen';
        container.appendChild(text);
        return;
    }
    container.className = 'systemHealthCard has-problems';
    const problems = health.problems || [];
    const count = health.problemCount || problems.length;
    const title = document.createElement('div');
    title.className = 'systemHealthCardTitle';
    title.textContent = count === 1
        ? 'Ein Problem erfordert deine Aufmerksamkeit:'
        : count + ' Probleme erfordern deine Aufmerksamkeit:';
    container.appendChild(title);
    const list = document.createElement('ul');
    list.className = 'systemHealthProblemList';
    for (const problem of problems) {
        const item = document.createElement('li');
        item.textContent = problem.message;
        list.appendChild(item);
    }
    container.appendChild(list);
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
        renderSystemHealth();
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

        renderGeneralConfigSection();
        renderIntegrationSections();
        renderNotificationSection();
        renderConfigWarnings();
        renderSystemHealth();
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

// Unlike matchesDeviceClass('power'), this also excludes binary_sensor entities that carry HA's
// (legitimate, but here irrelevant) binary_sensor device_class "power" (on/off "is drawing power",
// not a numeric W/kW reading) - those were showing up in the Wechselrichter sensor dropdowns.
function matchesPowerUnit(entity) {
    if (entity.unit === 'W' || entity.unit === 'kW') return true;
    // give the benefit of the doubt only when we genuinely have no unit info to check
    return isAmbiguousState(entity.state) && !entity.unit;
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
    if (filter.type === 'power_unit') return matchesPowerUnit(entity);
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
    // Demo-Geraet braucht keine Sensor-/Actor-Zuordnung - zeigt Beispieldaten (siehe get_demo_value
    // in sync_service.py), gilt also immer als vollstaendig konfiguriert.
    if (currentIds.length === 1 && currentIds[0] === DEMO_INTEGRATION_ID) return true;

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

// Site-weite staticConfig-Felder, die zu keinem einzelnen Geraet gehoeren (Stromtarife) - eigener
// Block oberhalb der Geraete-Kacheln statt einer davon. Optimierungszeitraum bekommt bewusst kein
// Eingabefeld (bleibt serverseitig beim Default 48h, spaeter automatisch reduziert falls der
// Optimizer zu lange braucht) und Gaspreis gehoert an ein noch nicht implementiertes
// "Blockheizkraftwerk"-Geraet - beide Felder bleiben in collect_static_config vorbereitet, nur ohne UI.
function renderGeneralConfigSection() {
    const container = document.getElementById('config');
    if (!container) {
        return;
    }
    container.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = 'Strom';
    container.appendChild(heading);

    container.appendChild(buildElectricityBaseLoadField());
    container.appendChild(buildElectricityPriceBuyField());
    container.appendChild(buildElectricityPriceSellField());
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
            const previousIds = currentIntegrationSelections[section.key];
            const wasEmpty = previousIds.length === 0;
            // Demo->echtes Geraet zaehlt wie "vorher leer" - der Nutzer muss die neuen Sensorfelder
            // ja jetzt erst ausfuellen, genau wie bei einer erstmaligen Auswahl.
            const wasDemo = previousIds.length === 1 && previousIds[0] === DEMO_INTEGRATION_ID;
            const becameReal = !(selectedIds.length === 1 && selectedIds[0] === DEMO_INTEGRATION_ID);
            currentIntegrationSelections[section.key] = selectedIds;
            if (selectedIds.length > 0) {
                renderSectionBody(bodyDiv, section, selectedIds);
                if (wasEmpty || (wasDemo && becameReal)) expanded = true;
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

    // Ein <div role="button"> statt eines echten <button> - die pro Geraet anzeigten "×"-Buttons
    // (siehe buildChip) muessen selbst echte <button>-Elemente sein (fuer Tastatur-Bedienbarkeit),
    // und ein <button> im <button> ist ungueltiges HTML mit inkonsistentem Verhalten je nach Browser.
    const button = document.createElement('div');
    button.className = 'integrationPickerButton';
    button.setAttribute('role', 'button');
    button.tabIndex = 0;
    button.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            button.click();
        }
    });
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
    // Demo-Geraet als eigene, synthetische Option ganz oben - kein integrationsData-Eintrag, wird
    // separat behandelt (siehe DEMO_INTEGRATION_ID).
    const demoOption = section.hasDemo ? {id: DEMO_INTEGRATION_ID, name: 'Demo-Gerät'} : null;

    let selectedIds = [...currentIds];

    // Entfernt genau ein ausgewaehltes Geraet (per Checkbox-Abwaehl ODER per "×" an seinem Chip, siehe
    // buildChip) - zentral hier statt an beiden Stellen dupliziert, da beide denselben Ablauf
    // brauchen: selectedIds aktualisieren, Button+Liste neu zeichnen, onChange (schreibt configData/
    // integrationMappings) benachrichtigen.
    function removeSelection(id) {
        selectedIds = selectedIds.filter(existing => existing !== id);
        updateButtonText();
        if (!panel.hidden) renderList(search.value);
        onChange([...selectedIds]);
    }

    // Ein "×" pro ausgewaehltem Geraet direkt im (geschlossenen) Button, statt das Panel oeffnen und
    // die Checkbox suchen zu muessen, um ein versehentlich gewaehltes Geraet wieder loszuwerden.
    function buildChip(id, name) {
        const chip = document.createElement('span');
        chip.className = 'integrationPickerChip';
        const label = document.createElement('span');
        label.className = 'integrationPickerChipLabel';
        label.textContent = name;
        chip.appendChild(label);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'integrationPickerChipRemove';
        remove.textContent = '×';
        remove.title = `${name} entfernen`;
        remove.setAttribute('aria-label', `${name} entfernen`);
        remove.addEventListener('click', (event) => {
            // Verhindert, dass der Klick zum umschliessenden Button durchreicht und das Panel
            // oeffnet/schliesst - das "×" soll ausschliesslich das Geraet entfernen.
            event.stopPropagation();
            removeSelection(id);
        });
        chip.appendChild(remove);
        return chip;
    }

    function updateButtonText() {
        buttonText.innerHTML = '';
        if (selectedIds.length === 0) {
            buttonText.textContent = 'nicht vorhanden';
        } else if (demoOption && selectedIds.length === 1 && selectedIds[0] === DEMO_INTEGRATION_ID) {
            buttonText.appendChild(buildChip(demoOption.id, demoOption.name));
        } else {
            for (const id of selectedIds) {
                const name = (integrationsData.integrations.find(integration => integration.id === id) || {}).name || id;
                buttonText.appendChild(buildChip(id, name));
            }
        }
    }

    function renderList(filterText) {
        list.innerHTML = '';
        const normalizedFilter = (filterText || '').trim().toLowerCase();
        const filtered = options.filter(integration => integration.name.toLowerCase().includes(normalizedFilter));
        // Demo-Geraet nur anzeigen, solange danach gesucht wird bzw. das Suchfeld leer ist - sonst
        // taucht "Demo-Gerät" bei jeder Sensor-Suche mit auf.
        const showDemoOption = demoOption && demoOption.name.toLowerCase().includes(normalizedFilter);

        if (filtered.length === 0 && !showDemoOption) {
            const empty = document.createElement('div');
            empty.className = 'integrationPickerEmpty';
            empty.textContent = 'Keine Treffer';
            list.appendChild(empty);
            return;
        }

        function buildCheckbox(id, name, {isDemo = false} = {}) {
            const optionLabel = document.createElement('label');
            optionLabel.className = 'integrationPickerOption';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = id;
            checkbox.checked = selectedIds.includes(id);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    // Demo-Geraet und echte Integrationen schliessen sich gegenseitig aus - entweder
                    // Beispieldaten oder ein echtes Geraet, nie beides gleichzeitig.
                    selectedIds = isDemo ? [id] : [...selectedIds.filter(existing => existing !== DEMO_INTEGRATION_ID), id];
                    updateButtonText();
                    renderList(search.value);
                    onChange([...selectedIds]);
                } else {
                    removeSelection(id);
                }
            });

            const text = document.createElement('span');
            text.textContent = name;

            optionLabel.appendChild(checkbox);
            optionLabel.appendChild(text);
            return optionLabel;
        }

        if (showDemoOption) {
            list.appendChild(buildCheckbox(demoOption.id, demoOption.name, {isDemo: true}));
        }
        for (const integration of filtered) {
            list.appendChild(buildCheckbox(integration.id, integration.name));
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

    // Demo-Geraet: keine echten Entities zum Mappen, keine echte Steuerung - kurzer Hinweis statt
    // der ganzen Sensor-/Steuerungs-UI. Sensorwerte kommen stattdessen aus get_demo_value
    // (sync_service.py), automatisch verwendet sobald integrationMappings[section.key] == ["demo"].
    if (entryIds.length === 1 && entryIds[0] === DEMO_INTEGRATION_ID) {
        const note = document.createElement('div');
        note.className = 'intro';
        note.textContent = 'Demo-Gerät aktiv – zeigt Beispieldaten. Wähle oben ein echtes Gerät aus deiner Home-Assistant-Umgebung, sobald du eines hinterlegen willst.';
        bodyDiv.appendChild(note);
        return;
    }

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
            bodyDiv.appendChild(buildWallboxMaxPhasesField());
            bodyDiv.appendChild(buildWallboxMaxCurrentField());
            bodyDiv.appendChild(buildWallboxConnectionStatusMapping());
        }
        if (section.key === 'batterie') {
            bodyDiv.appendChild(buildBatteryFlowSignOverrideField());
            bodyDiv.appendChild(buildBatteryCapacityField());
            bodyDiv.appendChild(buildBatterySocMinField());
        }
        if (section.key === 'auto') {
            bodyDiv.appendChild(buildCarBatteryCapacityField());
            bodyDiv.appendChild(buildCarConsumptionField());
            bodyDiv.appendChild(buildEvSocNormalField());
            bodyDiv.appendChild(buildEvSocMaxPvSurplusField());
        }
        if (section.key === 'waermepumpe') {
            bodyDiv.appendChild(buildHpTypeField());
            bodyDiv.appendChild(buildHpBuildingSizeField());
            bodyDiv.appendChild(buildHpEnergyEfficiencyField());
            bodyDiv.appendChild(buildHpDhwTankSizeField());
            bodyDiv.appendChild(buildHpMaxPowerField());
            bodyDiv.appendChild(buildHpMaxSupplyTempField());
            bodyDiv.appendChild(buildHpHeatingBufferField());
            bodyDiv.appendChild(buildHpHeatingCurveLevelField());
            bodyDiv.appendChild(buildHpHeatingCurveSlopeField());
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
function buildConfigNumberField({label, tooltip, id, configKey, placeholder, step = '0.1', defaultValue = null, min = '0', max = null}) {
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
    input.min = min;
    if (max !== null) input.max = max;
    input.step = step;
    input.placeholder = placeholder;
    input.value = configData[configKey] ?? defaultValue ?? '';
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

// Generic dropdown config field, analogous to buildConfigNumberField - options is a list of
// [value, label] pairs. value is what gets stored in configData[configKey] (and later sent to
// shyft-power as-is, since these values are meant to match Bubble Option Set entries exactly).
function buildConfigSelectField({label, tooltip, id, configKey, options, defaultValue = null}) {
    const wrapper = document.createElement('div');
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    const labelCell = document.createElement('td');
    labelCell.textContent = label;
    labelCell.appendChild(buildTooltip(tooltip));
    const valueCell = document.createElement('td');
    const select = document.createElement('select');
    select.id = id;
    select.className = 'sensorInput';
    for (const [value, text] of options) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        select.appendChild(option);
    }
    select.value = configData[configKey] ?? defaultValue ?? options[0][0];
    select.addEventListener('change', () => {
        configData[configKey] = select.value;
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

// staticConfig fields shyft-power's optimizer needs but that aren't live sensor readings - asked
// once here in the addon instead of via a Bubble form. Values match Bubble Option Set entries
// exactly (see shyft's SiteEntityRepository mapToXyz switch statements) so the Java server can
// look them up unchanged. See addon_sensor_data_JSON/staticConfig in sync_site_data (app.py).

function buildHpBuildingSizeField() {
    return buildConfigSelectField({
        label: 'Wohnfläche',
        tooltip: 'Beheizte Wohnfläche des Gebäudes - wird für die Heizlastberechnung benötigt.',
        id: 'hp_building_size',
        configKey: 'hpBuildingSize',
        options: ['80 m²', '130 m²', '180 m²', '230 m²', '300 m²', '400 m²'].map(v => [v, v]),
        defaultValue: '130 m²',
    });
}

function buildHpEnergyEfficiencyField() {
    return buildConfigSelectField({
        label: 'Energieeffizienz Gebäude',
        tooltip: 'Grobe Einstufung der Gebäudedämmung (Energiebedarf pro m² und Jahr) - je niedriger, desto besser gedämmt.',
        id: 'hp_energy_efficiency',
        configKey: 'hpEnergyEfficiency',
        options: [
            'A (40 kWh/a/m²)', 'B (60 kWh/a/m²)', 'C (90 kWh/a/m²)',
            'D (120 kWh/a/m²)', 'E (160 kWh/a/m²)', 'F (200 kWh/a/m²)',
        ].map(v => [v, v]),
        defaultValue: 'C (90 kWh/a/m²)',
    });
}

function buildHpDhwTankSizeField() {
    return buildConfigSelectField({
        label: 'Warmwasser-Speichergröße',
        tooltip: 'Größe des Warmwasserspeichers deiner Wärmepumpe.',
        id: 'hp_dhw_tank_size',
        configKey: 'hpDhwTankSize',
        options: [
            'sehr klein (100 Liter)', 'klein (200 Liter)', 'mittel (300 Liter)',
            'groß (400 Liter)', 'sehr groß (600 Liter)', 'riesig (1.000 Liter)',
        ].map(v => [v, v]),
        defaultValue: 'klein (200 Liter)',
    });
}

function buildHpMaxPowerField() {
    return buildConfigSelectField({
        label: 'Max. elektrische Leistung',
        tooltip: 'Maximale elektrische Leistungsaufnahme deiner Wärmepumpe.',
        id: 'hp_max_power',
        configKey: 'hpMaxPower',
        options: ['klein (4 kW)', 'mittel (6 kW)', 'groß (8 kW)', 'sehr groß (12 kW)'].map(v => [v, v]),
        defaultValue: 'mittel (6 kW)',
    });
}

function buildHpTypeField() {
    return buildConfigSelectField({
        label: 'Wärmepumpen-Typ',
        tooltip: 'Bauart deiner Wärmepumpe.',
        id: 'hp_type',
        configKey: 'hpType',
        options: [['Air-Air', 'Luft-Luft'], ['Air-Water', 'Luft-Wasser'], ['Brine-Water', 'Sole-Wasser']],
        defaultValue: 'Air-Water',
    });
}

// Bubble's Option Set entries here encode the numeric buffer factor directly in the value
// ("name__zahl", e.g. "mittel__0.2") so new options can be added on the Bubble side without a
// server code change (see HpHeatingBuffer.java's extractValueFromName fallback) - the label shown
// here is just the "name" part, the "__zahl" suffix is invisible to the user.
function buildHpHeatingBufferField() {
    return buildConfigSelectField({
        label: 'Heizungspuffer',
        tooltip: 'Wie viel Spielraum die Optimierung beim Vorheizen der Innentemperatur oberhalb der Soll-Temperatur nutzen darf, bevor sie stoppt.',
        id: 'hp_heating_buffer',
        configKey: 'hpHeatingBuffer',
        options: [['gering__0.1', 'gering'], ['mittel__0.2', 'mittel'], ['hoch__0.3', 'hoch']],
        defaultValue: 'mittel__0.2',
    });
}

function buildHpMaxSupplyTempField() {
    return buildConfigNumberField({
        label: 'Max. Vorlauftemperatur (°C)',
        tooltip: 'Höchste Vorlauftemperatur, die deine Wärmepumpe liefern kann.',
        id: 'hp_max_supply_temp',
        configKey: 'hpMaxSupplyTempC',
        placeholder: 'z.B. 55',
        defaultValue: 55,
        step: '1',
    });
}

function buildHpHeatingCurveLevelField() {
    return buildConfigNumberField({
        label: 'Heizkurve, Niveau',
        tooltip: 'Niveau-Parameter deiner Heizkurve (aus der Wärmepumpen-App/-Anzeige übernehmen).',
        id: 'hp_heating_curve_level',
        configKey: 'hpHeatingCurveLevel',
        placeholder: 'z.B. 0',
        defaultValue: 0,
    });
}

function buildHpHeatingCurveSlopeField() {
    return buildConfigNumberField({
        label: 'Heizkurve, Steigung',
        tooltip: 'Steigungs-Parameter deiner Heizkurve (aus der Wärmepumpen-App/-Anzeige übernehmen).',
        id: 'hp_heating_curve_slope',
        configKey: 'hpHeatingCurveSlope',
        placeholder: 'z.B. 1.2',
        defaultValue: 1.2,
    });
}

function buildBatteryCapacityField() {
    return buildConfigNumberField({
        label: 'Kapazität (kWh)',
        tooltip: 'Gesamtkapazität deines Hausspeichers.',
        id: 'battery_capacity_kwh',
        configKey: 'batteryCapacityKwh',
        placeholder: 'z.B. 10',
        defaultValue: 10,
        step: '0.5',
    });
}

function buildBatterySocMinField() {
    return buildConfigNumberField({
        label: 'Min. Ladestand (%)',
        tooltip: 'Ladestand, unter den die Optimierung deinen Hausspeicher nicht entladen soll.',
        id: 'battery_soc_min',
        configKey: 'batterySocMinPercent',
        placeholder: 'z.B. 10',
        defaultValue: 10,
        step: '1',
    });
}

function buildEvSocNormalField() {
    return buildConfigSelectField({
        label: 'Mindestladestand',
        tooltip: 'Wie viel Prozent der Batterie sollen unabhängig von den geplanten Fahrten möglichst schnell geladen und für spontane Fahrten vorgehalten werden?',
        id: 'ev_soc_normal',
        configKey: 'evSocNormal',
        options: ['10 %', '20 %', '30 %', '40 %', '50 %', '60 %', '70 %', '80 %'].map(v => [v, v]),
        defaultValue: '10 %',
    });
}

// Deckelt nur das PV-Ueberschussladen (siehe run_pv_surplus_charging_tick in app.py) - geplante
// Strecken und sehr guenstiger Netzstrom laden trotzdem bis zum vollen/gewuenschten Ladestand,
// diese Grenze soll die Autobatterie nur vor unnoetig haeufigem Vollladen durch PV-Ueberschuss
// schuetzen. 60-95%, da darunter der Nutzen fraglich waere und 100% die Grenze ohnehin sinnlos macht.
function buildEvSocMaxPvSurplusField() {
    return buildConfigNumberField({
        label: 'Maximaler Ladestand (PV-Überschuss)',
        tooltip: 'Setze für PV-Überschussladen einen maximalen Ladestand, um die Autobatterie zu schonen. Für geplante Strecken gilt diese Grenze nicht. Auch wird bei sehr günstigem Netzstrom vollgeladen.',
        id: 'ev_soc_max_pv_surplus',
        configKey: 'evSocMaxPvSurplus',
        placeholder: 'z.B. 80',
        min: '60',
        max: '95',
        step: '1',
    });
}

// Site-weite Felder ohne eigene Geräte-Kachel - siehe buildGeneralConfigSection.
function buildCoPriceGasField() {
    return buildConfigNumberField({
        label: 'Gaspreis (€/kWh)',
        tooltip: 'Dein aktueller Gaspreis, falls du eine zweite Wärmequelle (z.B. Gas-Zusatzheizung) hast.',
        id: 'co_price_gas',
        configKey: 'coPriceGas',
        placeholder: 'z.B. 0.10',
        defaultValue: 0.1,
        step: '0.01',
    });
}

function buildOptimizationPeriodsField() {
    return buildConfigNumberField({
        label: 'Optimierungszeitraum (Stunden)',
        tooltip: 'Wie viele Stunden im Voraus die Optimierung plant.',
        id: 'optimization_periods_site',
        configKey: 'optimizationPeriodsSite',
        placeholder: 'z.B. 48',
        defaultValue: 48,
        step: '1',
    });
}

// Unlike the other option-set fields (which Java matches via plain switch-statements, no Bubble
// call needed), Electricity Base Load's options live in a dynamic Bubble table
// (ElectricityBaseLoadValueRepository) - looking it up by label would mean a Bubble call even in
// the new JSON-based flow. So the value (kWh/year) is embedded directly in "label__value" form
// instead, same trick as buildHpHeatingBufferField/HpHeatingBuffer.java's extractValueFromName -
// Java's future JSON parser needs the equivalent fallback for this field.
function buildElectricityBaseLoadField() {
    return buildConfigSelectField({
        label: 'Grundlast Strom (Jahr)',
        tooltip: 'Dein jährlicher Stromverbrauch ohne Wärmepumpe/EV/Batterie (Haushaltsgeräte, Beleuchtung etc.).',
        id: 'electricity_base_load',
        configKey: 'electricityBaseLoad',
        options: [
            ['sehr niedrig__1314', 'sehr niedrig'],
            ['niedrig__2628', 'niedrig'],
            ['mittel__4380', 'mittel'],
            ['hoch__6570', 'hoch'],
            ['noch höher__8760', 'noch höher'],
            ['sehr hoch__13140', 'sehr hoch'],
        ],
        defaultValue: 'niedrig__2628',
    });
}

function buildElectricityPriceBuyField() {
    return buildConfigSelectField({
        label: 'Strompreis (Einkauf)',
        tooltip: 'Dein ungefährer Strompreis, falls du keinen dynamischen Tarif hast.',
        id: 'electricity_price_buy',
        configKey: 'electricityPriceBuy',
        options: [
            'sehr niedrig (20 Cent)', 'niedrig (25 Cent)', 'mittel (30 Cent)',
            'hoch (35 Cent)', 'sehr hoch (40 Cent)',
        ].map(v => [v, v]),
        defaultValue: 'mittel (30 Cent)',
    });
}

function buildElectricityPriceSellField() {
    return buildConfigSelectField({
        label: 'Einspeisevergütung',
        tooltip: 'Deine ungefähre Einspeisevergütung für PV-Überschuss.',
        id: 'electricity_price_sell',
        configKey: 'electricityPriceSell',
        options: [
            'sehr niedrig (6 Cent)', 'niedrig (8 Cent)', 'mittel (10 Cent)',
            'hoch (15 Cent)', 'sehr hoch (20 Cent)',
        ].map(v => [v, v]),
        defaultValue: 'mittel (10 Cent)',
    });
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

// Begrenzen zusammen mit "Max. Stromstärke (pro Phase)" den maximal an die Wallbox gesendeten
// Ziel-kW-Wert (z.B. beim PV-Überschussladen-Regelkreis) - ohne diese Obergrenze kann ein
// Regelkreis einen Wert anfordern, den die Wallbox ohnehin ablehnt (siehe compute_wallbox_max_kw
// in app.py). 3 ist die häufigste Anschlussart und daher vorbelegt.
function buildWallboxMaxPhasesField() {
    const wrapper = document.createElement('div');
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    const labelCell = document.createElement('td');
    labelCell.textContent = 'Max. Anzahl an Phasen';
    labelCell.appendChild(buildTooltip('Wie viele Phasen deine Wallbox maximal nutzen kann (3 bei einem dreiphasigen Anschluss, 1 bei einer einphasigen Wallbox). Zusammen mit "Max. Stromstärke (pro Phase)" begrenzt shyft-power damit den höchsten Wert, den es z.B. beim PV-Überschussladen jemals anfordert.'));
    const valueCell = document.createElement('td');
    const select = document.createElement('select');
    select.id = 'wallbox_max_phases';
    select.className = 'sensorInput';
    for (const value of ['1', '3']) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value === '1' ? '1 (einphasig)' : '3 (dreiphasig)';
        select.appendChild(option);
    }
    select.value = String(configData['wallboxMaxPhases'] ?? 3);
    select.addEventListener('change', () => {
        configData['wallboxMaxPhases'] = parseInt(select.value, 10);
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

function buildWallboxMaxCurrentField() {
    return buildConfigNumberField({
        label: 'Max. Stromstärke (pro Phase)',
        tooltip: 'Die höchste Stromstärke pro Phase, die deine Wallbox (bzw. der Stromkreis, an dem sie hängt) zulässt. Zusammen mit "Max. Anzahl an Phasen" begrenzt shyft-power damit den höchsten Ziel-kW-Wert, den es z.B. beim PV-Überschussladen jemals anfordert - unabhängig davon, wie hoch der berechnete Überschuss gerade ist.',
        id: 'wallbox_max_current_amps',
        configKey: 'wallboxMaxCurrentAmps',
        placeholder: 'z.B. 16',
        defaultValue: 16,
        step: '1',
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

    // automationOnly controls (kein sensorField, keine "Direkt steuern"-Option) sind immer
    // ha_automation - kein Dropdown noetig, es gibt ja nur die eine Variante.
    let variant = control.automationOnly ? 'ha_automation'
        : control.hasAutomationVariant ? ((configData['controlVariant'] || {})[control.key] || 'direct')
        : 'direct';

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
    }
    if (control.hasAutomationVariant || control.automationOnly) {
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

    // marks this step on the continuous vertical line running down .carChargeStages (see CSS).
    // Single-stage recipes (e.g. "Warmwasserbereitung") aren't wrapped in .carChargeStages and
    // skip this - a lone dot with no line to sit on would misleadingly suggest a multi-step process.
    const stageDot = showDot ? document.createElement('span') : null;
    if (stageDot) {
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

    if (stageDot) {
        // Exact vertical center of the "1./2./3. ..." label cell, measured after the tree is
        // actually connected to the document (offsetTop/offsetHeight are 0 otherwise) - replaces a
        // previous fixed top:0.65em guess that didn't quite line up with the real text baseline.
        requestAnimationFrame(() => {
            stageDot.style.top = (serviceLabelCell.offsetTop + serviceLabelCell.offsetHeight / 2) + 'px';
        });
    }

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
    // Drei echte Zustaende statt nur zwei: '' (noch nichts gewaehlt - weder "Befehl" noch die
    // Automations-Zeile werden angezeigt), 'direct' ("HA-Aktion"), 'ha_automation'. Vorher fiel
    // alles, was nicht explizit "ha_automation" war, automatisch auf "direct" zurueck, wodurch das
    // "Befehl"-Feld schon vor jeder Auswahl sichtbar war.
    let variant = recipe.type === 'ha_automation' ? 'ha_automation' : (recipe.type === 'direct' ? 'direct' : '');
    checkmark.hidden = variant === 'ha_automation' ? !recipe.haAutomationEntityId : !recipe.service;

    // "Varianten" zuerst (siehe Reihenfolge weiter unten) - erst nach einer Auswahl blendet sich
    // das passende Eingabefeld darunter ein, statt beide gleichzeitig zu zeigen.
    const variantSelect = document.createElement('select');
    variantSelect.id = 'hot_water_variant';
    variantSelect.className = 'sensorInput';
    for (const [value, text] of [['', 'Befehl auswählen'], ['direct', 'HA-Aktion'], ['ha_automation', 'HA-Automation']]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        variantSelect.appendChild(option);
    }
    variantSelect.value = variant;
    const variantTable = document.createElement('table');
    const variantTbody = document.createElement('tbody');
    const variantRow = document.createElement('tr');
    const variantLabelCell = document.createElement('td');
    variantLabelCell.textContent = 'Varianten';
    variantLabelCell.appendChild(buildTooltip('Wie das Addon die Warmwasserbereitung auslöst: entweder direkt über einen Wärmepumpen-Befehl (HA-Aktion), oder indem es eine selbst erstellte Automation triggert (HA-Automation).'));
    const variantValueCell = document.createElement('td');
    variantValueCell.appendChild(variantSelect);
    variantRow.appendChild(variantLabelCell);
    variantRow.appendChild(variantValueCell);
    variantTbody.appendChild(variantRow);
    variantTable.appendChild(variantTbody);
    wrapper.appendChild(variantTable);

    const candidateServices = allServiceOptions.filter(s => getIntegrationServiceDomains('waermepumpe').has(s.service.split('.')[0]));
    const stageWrapper = buildBranchedStageFields('hot_water_', 'hotWater', 'Befehl',
        'Befehl, mit dem die (einmalige) Warmwasserbereitung an deiner Wärmepumpe aktiviert wird.',
        candidateServices, recipe, [], [], 'z.B. activate_onetimecharge', undefined, false);
    stageWrapper.style.display = variant === 'direct' ? '' : 'none';
    wrapper.appendChild(stageWrapper);

    const automationRow = buildAutomationEntityRow('HA-Automation auswählen',
        'Zum Auslösen der Warmwasserbereitung kannst du deine selber erstellte Automation hinterlegen.',
        'hot_water_ha_automation_entity', recipe.haAutomationEntityId, 'z.B. automation.warmwasser_starten');
    automationRow.style.display = variant === 'ha_automation' ? '' : 'none';
    wrapper.appendChild(automationRow);

    const automationInput = automationRow.querySelector('input');
    function refreshCheckmark() {
        if (variant === 'ha_automation') {
            checkmark.hidden = !automationInput.value;
        } else if (variant === 'direct') {
            const serviceInput = document.getElementById('hot_water_hotWater_service');
            checkmark.hidden = !(serviceInput && serviceInput.value);
        } else {
            checkmark.hidden = true;
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

    // Eigener, immer sichtbarer Pfeil ganz rechts (siehe .inputDropdownArrow) - rein dekorativ,
    // pointer-events:none reicht Klicks ans Input darunter durch.
    const dropdownArrow = document.createElement('span');
    dropdownArrow.className = 'inputDropdownArrow';
    dropdownArrow.textContent = '▾';
    dropdownArrow.setAttribute('aria-hidden', 'true');
    inputWrapper.appendChild(dropdownArrow);

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

// Stunden, innerhalb derer eine noch nicht gestartete Aktion als "demnaechst geplant" zaehlt (siehe
// renderShyftActions) - rein informativ fuer den Hinweistext, kein Schwellwert fuer irgendeine Logik.
const UPCOMING_ACTION_WINDOW_HOURS = 3;

// True, wenn mindestens eine Aktion gerade laeuft (Status "Aktiv...") oder innerhalb der naechsten
// UPCOMING_ACTION_WINDOW_HOURS startet - unabhaengig vom Status-Text, allein anhand von "Date Start"
// (robuster als auf einen bestimmten "geplant"-Wortlaut zu pruefen).
function hasActiveOrUpcomingAction(actions) {
    const now = Date.now();
    const windowEnd = now + UPCOMING_ACTION_WINDOW_HOURS * 3600 * 1000;
    return actions.some(action => {
        const status = (action['Status'] || '').toLowerCase();
        if (status.startsWith('aktiv')) return true;
        const start = action['Date Start'];
        return typeof start === 'number' && start >= now && start <= windowEnd;
    });
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

    if (!hasActiveOrUpcomingAction(actions)) {
        const hint = document.createElement('div');
        hint.className = 'shyftActionsEmpty';
        hint.textContent = `Keine Aktionen in den nächsten ${UPCOMING_ACTION_WINDOW_HOURS} Stunden geplant.`;
        container.appendChild(hint);
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
// "Übermorgen" wird bewusst nicht mehr ausgewiesen (nur Heute/Morgen) - ein 48h-Fenster deckt
// diesen Tag rechnerisch nie vollstaendig ab (Heute + Morgen allein verbrauchen schon mindestens
// 24h davon), die Summe wirkte dadurch irrefuehrend unvollstaendig. "Vollstaendig" heißt hier
// ohnehin nicht "Mitternacht bis Mitternacht", sondern "die PV-Erzeugung ist erkennbar auf 0
// gefallen": sobald ab PV_COMPLETE_CHECK_FROM_HOUR (17 Uhr - spätestens 21 Uhr wäre auch im
// Hochsommer sicher, im Winter geht die Sonne aber teils schon um 17 Uhr unter) ein Wert nahe 0
// auftaucht, gilt der Tag als abgeschlossen; ein erneuter Anstieg danach ist im selben Kalendertag
// praktisch ausgeschlossen. Nur "Heute" ist von dieser Prüfung ausgenommen, da dort absichtlich
// nur die Teilsumme gezeigt wird.
// Die "Einsatzplan"-Karte direkt unter dem PV-Prognose-Chart: Kennzahlen des aktuellen
// Optimierungslaufs (siehe _compute_einsatzplan_summary in app.py), einmal pro Dashboard-Ladung
// aus /dashboard/chart-data gelesen (keine eigene Live-Berechnung im Frontend noetig).
function formatEinsatzplanValue(value, unit, decimals) {
    if (value === null || value === undefined) return '-';
    const formatted = decimals ? value.toFixed(decimals) : Math.round(value);
    // unit optional (leer/null) - fuer die Heute|Morgen-Kurzwerte hinter der grossen Zahl (siehe
    // buildEinsatzplanCard), wo die Einheit schon einmal an der grossen Zahl steht und nicht noch
    // zweimal wiederholt werden soll (v.a. bei "Cent/kWh" faellt das unnoetig lang aus).
    return unit ? `${formatted} ${unit}` : `${formatted}`;
}

// Reihenfolge/Einheiten/Nachkommastellen der vier Kacheln - dieselben Keys stehen sowohl auf
// Top-Level von 'einsatzplan' (voller Zeitraum) als auch unter 'einsatzplan.heute'/'.morgen'
// (siehe _compute_einsatzplan_kpis in app.py).
const EINSATZPLAN_STATS = [
    ['stromverbrauch_kwh', 'Stromverbrauch', 'kWh', 0],
    ['netzstrom_preis_cent', 'ø Netzstrom', 'Cent/kWh', 1],
    ['autarkie_pct', 'Autarkie', '%', 0],
    ['eigenverbrauch_pct', 'Eigenverbrauch', '%', 0],
    ['stromertrag_eur', 'Stromertrag', '€', 2],
];

function buildEinsatzplanCard(einsatzplan, optimizerRunning) {
    const card = document.createElement('div');
    card.className = 'einsatzplanCard';

    const title = document.createElement('div');
    title.className = 'einsatzplanTitle';
    title.textContent = 'Einsatzplan';
    card.appendChild(title);

    const heute = einsatzplan.heute || {};
    const morgen = einsatzplan.morgen || {};

    const grid = document.createElement('div');
    grid.className = 'einsatzplanGrid';
    for (const [key, label, unit, decimals] of EINSATZPLAN_STATS) {
        const stat = document.createElement('div');
        stat.className = 'einsatzplanStat';
        const labelEl = document.createElement('div');
        labelEl.className = 'einsatzplanStatLabel';
        labelEl.textContent = label;
        // Kompakte Kachel: grosse Hauptzahl OHNE Einheit, dahinter klein die Heute|Morgen-Werte in
        // Klammern, dahinter klein die Einheit - "47 (2 | 30) kWh" statt vorher "47 kWh (2 | 30)"
        // (Einheit doppelt so gross wie noetig mitgezogen) bzw. noch frueher einer eigenen Zeile
        // darunter.
        const valueRow = document.createElement('div');
        valueRow.className = 'einsatzplanStatValueRow';
        const valueEl = document.createElement('span');
        valueEl.className = 'einsatzplanStatValue';
        valueEl.textContent = formatEinsatzplanValue(einsatzplan[key], null, decimals);
        const subEl = document.createElement('span');
        subEl.className = 'einsatzplanStatSub';
        subEl.textContent = `(${formatEinsatzplanValue(heute[key], null, decimals)} | ${formatEinsatzplanValue(morgen[key], null, decimals)})`;
        const unitEl = document.createElement('span');
        unitEl.className = 'einsatzplanStatUnit';
        unitEl.textContent = unit;
        valueRow.appendChild(valueEl);
        valueRow.appendChild(subEl);
        valueRow.appendChild(unitEl);
        stat.appendChild(labelEl);
        stat.appendChild(valueRow);
        grid.appendChild(stat);
    }
    card.appendChild(grid);

    const legend = document.createElement('div');
    legend.className = 'einsatzplanLegend';
    legend.textContent = `Berechnet um ${formatShyftTime(einsatzplan.creation_date)} Uhr, Kennzahlen jeweils für die nächsten ${einsatzplan.hours} Stunden (bzw. in Klammern für die restlichen heutigen Stunden | für morgen).`;
    if (optimizerRunning) {
        const running = document.createElement('span');
        running.className = 'einsatzplanLegendRunning';
        running.textContent = ' Neue Optimierung läuft…';
        legend.appendChild(running);
    }
    card.appendChild(legend);

    return card;
}

// Restliche/volle PV-Ertrag pro Kalendertag (lokale Zeit), summiert aus den stuendlichen kW-Werten
// (ein kW-Wert ueber eine Stunde ist per Definition eine kWh). "Heute" zaehlt nur noch nicht
// vergangene Stunden. Wird direkt IN buildPvForecastActualChart eingezeichnet (neben der
// "Jetzt"-Linie bzw. der jeweiligen Tagesgrenze), nicht mehr als eigener Text unter dem Chart -
// stand dort vorher ohne erkennbaren Bezug zum Chart direkt neben der (inhaltlich anderen)
// Einsatzplan-Karte und wurde faelschlich fuer deren "Stromverbrauch"-Kennzahl gehalten.
//
// Nur Heute/Morgen - "Übermorgen" wird bewusst nicht ausgewiesen, das 48h-Fenster deckt diesen
// Tag ohnehin nie vollstaendig ab (siehe reachedZeroInEvening-Kommentar unten), die Summe wirkte
// dadurch irrefuehrend unvollstaendig.
function computePvEnergySummary(labels, values) {
    const PV_ZERO_THRESHOLD_KW = 0.05;
    const PV_COMPLETE_CHECK_FROM_HOUR = 17;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentHourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
    const dayLabels = ['Heute', 'Morgen'];
    const sums = [0, 0];
    const hasData = [false, false];
    const reachedZeroInEvening = [false, false];

    for (let i = 0; i < labels.length; i++) {
        const d = new Date(labels[i]);
        const startOfThatDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const dayOffset = Math.round((startOfThatDay - startOfToday) / (24 * 60 * 60 * 1000));
        if (dayOffset < 0 || dayOffset > 1) continue;
        if (dayOffset === 0 && d < currentHourStart) continue; // schon vergangene Stunde
        sums[dayOffset] += values[i];
        hasData[dayOffset] = true;
        if (d.getHours() >= PV_COMPLETE_CHECK_FROM_HOUR && values[i] <= PV_ZERO_THRESHOLD_KW) {
            reachedZeroInEvening[dayOffset] = true;
        }
    }

    // offset 0 = Heute (neben der "Jetzt"-Linie), offset 1 = Morgen (neben der 1. Tagesgrenze) -
    // der Aufrufer (buildPvForecastActualChart) ordnet ueber offset den passenden x-Koordinaten zu.
    const result = [];
    for (let offset = 0; offset < 2; offset++) {
        if (!hasData[offset]) continue;
        if (offset > 0 && !reachedZeroInEvening[offset]) continue;
        result.push({offset, label: dayLabels[offset], kwh: Math.round(sums[offset])});
    }
    return result;
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

// Vergleicht die heute frueh eingefrorene PV-Prognose mit den tatsaechlichen Messwerten (siehe
// /dashboard/pv-forecast-vs-actual) - eigene, schlankere Chart-Funktion statt buildLineChart zu
// erweitern: die war bisher nie fuer zwei Reihen auf gemeinsamer Zeitachse mit Luecken (null-Werte,
// wo eine Reihe fuer diese Stunde keine Daten hat) gebaut, und alle anderen Charts sollen davon
// unberuehrt bleiben. labels/forecast/actual sind bereits synchron (eine Stunde pro Index, ab 0 Uhr
// lokal) - siehe readPvForecastVsActual in app.py.
function buildPvForecastActualChart(labels, forecast, actual) {
    const width = 600, height = 220;
    const paddingLeft = 45, paddingRight = 15, paddingTop = 15, paddingBottom = 26;
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    const wrapper = document.createElement('div');
    wrapper.className = 'dashboardChart';
    const titleEl = document.createElement('div');
    titleEl.className = 'dashboardChartTitle';
    titleEl.textContent = 'PV-Leistung: Prognose vs. Ist (kW)';
    wrapper.appendChild(titleEl);

    const legend = document.createElement('div');
    legend.className = 'dashboardChartLegend';
    for (const [color, label] of [['var(--color-accent)', 'Prognose'], ['var(--color-text)', 'Ist-Werte']]) {
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

    const definedValues = [...forecast, ...actual].filter(v => v !== null && v !== undefined);
    if (labels.length === 0 || definedValues.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'shyftActionsEmpty';
        empty.textContent = 'Keine Daten verfügbar.';
        wrapper.appendChild(empty);
        return wrapper;
    }

    const rawMin = Math.min(...definedValues, 0);
    const rawMax = Math.max(...definedValues);
    const valueRange = (rawMax - rawMin) || 1;
    const yMin = rawMin - valueRange * 0.1;
    const yMax = rawMax + valueRange * 0.1;
    const yRange = (yMax - yMin) || 1;
    const lastIndex = labels.length - 1 || 1;

    const xFor = i => paddingLeft + (i / lastIndex) * plotWidth;
    const yFor = v => paddingTop + plotHeight - ((v - yMin) / yRange) * plotHeight;
    const baseline = paddingTop + plotHeight;

    // Baut den Linienpfad einer Reihe, die Luecken (null, z.B. Ist-Werte in der Zukunft) enthalten
    // kann - an jeder Luecke beginnt ein neuer Teilpfad (SVG erlaubt mehrere "M" in einem Pfad),
    // statt ueber sie hinweg zu verbinden.
    function buildSeriesPath(values, color, dashed) {
        const parts = [];
        let inSegment = false;
        for (let i = 0; i < values.length; i++) {
            const v = values[i];
            if (v === null || v === undefined) {
                inSegment = false;
                continue;
            }
            parts.push(`${inSegment ? 'L' : 'M'}${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`);
            inSegment = true;
        }
        if (parts.length < 2) return '';
        return `<path d="${parts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" ${dashed ? 'stroke-dasharray="5,4"' : ''} />`;
    }

    const forecastPath = buildSeriesPath(forecast, 'var(--color-accent)', true);
    const actualPath = buildSeriesPath(actual, 'var(--color-text)', false);

    const tickCount = Math.min(6, labels.length);
    const tickIndices = [...new Set(Array.from({length: tickCount}, (_, i) => Math.round(i * lastIndex / (tickCount - 1 || 1))))];
    const xLabels = tickIndices.map(i => {
        const x = xFor(i).toFixed(1);
        const text = new Date(labels[i]).toLocaleString('de-DE', {weekday: 'short', hour: '2-digit'}).replace('.', '');
        return `<text x="${x}" y="${height - 6}" fill="var(--color-text-secondary)" text-anchor="middle">${text}</text>`;
    }).join('');

    const yTicks = [yMax, (yMin + yMax) / 2, yMin];
    const yLabels = yTicks.map(v => {
        const y = yFor(v).toFixed(1);
        return `<text x="${paddingLeft - 8}" y="${(parseFloat(y) + 3).toFixed(1)}" fill="var(--color-text-secondary)" text-anchor="end">${v.toFixed(1)}</text>`;
    }).join('');

    // "Jetzt"-Markierung: Trennlinie zwischen den bereits vergangenen Stunden (mit Ist-Werten) und
    // der Zukunft (nur noch Prognose) - der letzte Index, an dem ein Ist-Wert vorliegt.
    let nowMarkup = '';
    const lastActualIndex = actual.reduce((last, v, i) => (v !== null && v !== undefined ? i : last), -1);
    if (lastActualIndex >= 0 && lastActualIndex < labels.length - 1) {
        const x = xFor(lastActualIndex).toFixed(1);
        nowMarkup = `<line x1="${x}" y1="${paddingTop}" x2="${x}" y2="${baseline.toFixed(1)}" stroke="var(--color-text)" stroke-width="1" stroke-dasharray="2,3" opacity="0.6" />`;
    }

    // dayBoundaryXs[0] = x der ERSTEN Tagesgrenze (Start "Morgen"), [1] = der zweiten (Start
    // "Uebermorgen", aktuell ungenutzt, computePvEnergySummary liefert dafuer keinen Wert) usw. -
    // offset in computePvEnergySummary ist 1-basiert dazu (offset 1 -> dayBoundaryXs[0]).
    let dayBoundaryMarkup = '';
    const dayBoundaryXs = [];
    for (let i = 1; i < labels.length; i++) {
        const prevDate = new Date(labels[i - 1]);
        const curDate = new Date(labels[i]);
        if (curDate.getDate() !== prevDate.getDate()) {
            const x = xFor(i).toFixed(1);
            const dateText = curDate.toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit'});
            dayBoundaryMarkup += `<line x1="${x}" y1="${paddingTop}" x2="${x}" y2="${baseline.toFixed(1)}" stroke="var(--color-text-secondary)" stroke-width="1.5" stroke-dasharray="4,3" />`;
            dayBoundaryMarkup += `<text x="${x}" y="${paddingTop - 4}" fill="var(--color-text)" font-weight="700" text-anchor="middle">${dateText}</text>`;
            dayBoundaryXs.push(parseFloat(x));
        }
    }

    // PV-Ertrag Heute/Morgen (siehe computePvEnergySummary) direkt im Chart neben der jeweiligen
    // Linie eingezeichnet, statt als separater Text unter dem Chart (frueher dort ohne erkennbaren
    // Bezug, wurde faelschlich fuer die "Stromverbrauch"-Kennzahl der Einsatzplan-Karte gehalten).
    // "Heute" rechts neben der "Jetzt"-Linie, "Morgen" rechts neben der 1. Tagesgrenze. Liegt "Jetzt"
    // (z.B. spaetabends) dicht vor der naechsten Tagesgrenze, ruecken beide Markierungen x-maessig
    // so nah zusammen, dass sich ihr Text ueberlappen wuerde - dann rutscht die zweite stattdessen
    // eine Zeile tiefer statt sie einfach uebereinander zu schreiben.
    const PV_SUMMARY_MIN_X_GAP = 70;
    let pvSummaryMarkup = '';
    const placedPvSummaryXs = [];
    for (const {offset, label, kwh} of computePvEnergySummary(labels, forecast)) {
        let x = null;
        if (offset === 0) {
            if (nowMarkup) x = xFor(lastActualIndex);
        } else {
            x = dayBoundaryXs[offset - 1];
        }
        if (x === null || x === undefined) continue;
        const overlapsPrevious = placedPvSummaryXs.some(prevX => Math.abs(prevX - x) < PV_SUMMARY_MIN_X_GAP);
        const y = paddingTop + 14 + (overlapsPrevious ? 14 : 0);
        pvSummaryMarkup += `<text x="${(x + 8).toFixed(1)}" y="${y.toFixed(1)}" fill="var(--color-text)" font-weight="700">${label}: ${kwh} kWh</text>`;
        placedPvSummaryXs.push(x);
    }

    const chartContainer = document.createElement('div');
    chartContainer.className = 'dashboardChartContainer';
    chartContainer.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" class="dashboardChartSvg">
            <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${baseline.toFixed(1)}" stroke="var(--color-border)" />
            <line x1="${paddingLeft}" y1="${baseline.toFixed(1)}" x2="${width - paddingRight}" y2="${baseline.toFixed(1)}" stroke="var(--color-border)" />
            ${nowMarkup}
            ${forecastPath}
            ${actualPath}
            ${dayBoundaryMarkup}
            ${pvSummaryMarkup}
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
        const parts = [];
        if (forecast[idx] !== null && forecast[idx] !== undefined) parts.push(`Prognose ${forecast[idx].toFixed(1)} kW`);
        if (actual[idx] !== null && actual[idx] !== undefined) parts.push(`Ist ${actual[idx].toFixed(1)} kW`);
        tooltip.textContent = `${dateText}: ${parts.join(' / ') || '–'}`;
        tooltip.style.left = xFor(idx).toFixed(1) * scale + 'px';
        tooltip.style.top = yFor(forecast[idx] ?? actual[idx] ?? yMin).toFixed(1) * scale + 'px';
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

// Unterhalb dieser Schwelle (kW, absolut) gilt eine Leitung als "kein nennenswerter Fluss" - sie
// bleibt als graue Leitung sichtbar, bekommt aber keine wandernden Punkte. Grid nutzt stattdessen
// die explizit gewuenschten 0.1 kW (siehe buildEnergyFlowWidget).
const FLOW_DOT_THRESHOLD_KW = 0.05;
let flowDotIdCounter = 0;

// Wanderungsdauer eines Punkts: logarithmisch schneller bei mehr kW, ohne harte Obergrenze bei
// kW selbst (nur die Dauer naehert sich einem praktischen Minimum an, damit es nie "hektisch"
// wirkt). 10 kW ist bewusst kein hartes Maximum, sondern nur ein Bezugspunkt der Kurve.
// Kalibriert auf FLOW_DOT_REFERENCE_LENGTH (siehe dort) - fuer eine Leitung anderer Laenge skaliert
// buildFlowDots diese Dauer proportional zur tatsaechlichen Pfadlaenge, damit die Punkte ueberall
// gleich schnell (px/s) wirken statt auf kurzen Leitungen (z.B. Haushaltsstrom) langsamer zu kriechen.
function flowDotDuration(kw) {
    const absKw = Math.abs(kw || 0);
    const minDuration = 1.1, maxDuration = 6.5;
    const duration = maxDuration / (1 + Math.log2(1 + absKw));
    return Math.max(minDuration, duration);
}

// Referenzlaenge (px, in SVG-Nutzereinheiten), auf die obige flowDotDuration-Kurve kalibriert ist -
// ungefaehr die typische Laenge einer Verbraucher-Zeile (busX bis Geraet). Siehe computePathLength.
const FLOW_DOT_REFERENCE_LENGTH = 100;

// Reine Geometrie-Berechnung der Gesamtlaenge eines Pfads, ohne dafuer ein <path>-Element ins DOM
// haengen zu muessen (SVGGeometryElement.getTotalLength() bräuchte das eigentlich nicht, ist aber
// je nach Browser zuverlässiger mit einem tatsächlich angehängten Element) - deckt genau die drei
// Pfad-Formen ab, die in diesem Widget je an buildFlowDots gehen: buildFlowPath (M + L, oder M+H+V),
// buildBusFlowPath (M+H+V+H) und die manuellen Spine-Pfade (M+V). Kein Bogen/Kurven-Support noetig,
// weil hier nie welche vorkommen.
function computePathLength(d) {
    const tokens = d.trim().split(/\s+/);
    let x = 0, y = 0, length = 0;
    for (let i = 0; i < tokens.length; i++) {
        const cmd = tokens[i];
        if (cmd === 'M' || cmd === 'L') {
            const [nx, ny] = tokens[++i].split(',').map(Number);
            if (cmd === 'L') length += Math.hypot(nx - x, ny - y);
            x = nx; y = ny;
        } else if (cmd === 'H') {
            const nx = Number(tokens[++i]);
            length += Math.abs(nx - x);
            x = nx;
        } else if (cmd === 'V') {
            const ny = Number(tokens[++i]);
            length += Math.abs(ny - y);
            y = ny;
        }
    }
    return length;
}

// Gerade Verbindung (Netz/Batterie), oder ein rechtwinkliger Knick, falls y1 != y2.
function buildFlowPath(x1, y1, x2, y2) {
    if (y1 === y2) return `M ${x1},${y1} L ${x2},${y2}`;
    return `M ${x1},${y1} H ${x2} V ${y2}`;
}

// Ein gemeinsamer Strompfad "Haus -> Verbraucher" (busX), der sich dort erst auf die jeweilige
// Verbraucher-Reihe aufteilt - alle vier rechten Verbraucher (Waermepumpe/Wallbox/Sonstiges
// Geraet/Haushaltsstrom) gehen vom selben Hausaustrittspunkt ab und teilen sich denselben
// senkrechten Bus, statt dass z.B. die Waermepumpen-Linie quer durch das Wallbox-Icon liefe.
function buildBusFlowPath(x1, y1, busX, y2, x2) {
    return `M ${x1},${y1} H ${busX} V ${y2} H ${x2}`;
}

// Die Leitung selbst (grau, statisch, immer sichtbar sobald das Geraet konfiguriert ist - auch
// ohne Fluss, siehe buildFlowLineFromPath) plus, bei nennenswertem Fluss, 2 versetzt wandernde
// leuchtende Punkte per <animateMotion an <mpath>, die derselben Pfad-Geometrie folgen.
// reversed dreht die Laufrichtung um (Ende->Start statt Start->Ende), fuer z.B. Einspeisung
// Richtung Netz statt Bezug vom Netz.
function buildFlowDots(d, kw, {reversed = false, thresholdKw = FLOW_DOT_THRESHOLD_KW} = {}) {
    const g = svgEl('g');
    const pathId = 'efw-flow-path-' + (flowDotIdCounter++);
    const conduit = svgEl('path', {d, id: pathId, class: 'energyFlowConduit', fill: 'none'});
    g.appendChild(conduit);

    const absKw = Math.abs(kw || 0);
    if (absKw < thresholdKw) {
        return g;
    }

    // Auf die tatsaechliche Pfadlaenge skaliert (siehe FLOW_DOT_REFERENCE_LENGTH) - sonst legen die
    // Punkte auf einer kurzen Leitung (z.B. Haushaltsstrom) dieselbe Dauer wie auf einer langen
    // zurueck und wirken dadurch sichtbar langsamer, obwohl derselbe kW-Wert dieselbe Geschwindigkeit
    // (px/s) suggerieren sollte.
    const pathLength = computePathLength(d);
    const duration = Math.max(0.2, Math.min(20, flowDotDuration(kw) * (pathLength / FLOW_DOT_REFERENCE_LENGTH)));
    for (const offsetFraction of [0, 0.5]) {
        const dot = svgEl('circle', {r: 3.2, class: 'energyFlowDot'});
        const motion = svgEl('animateMotion', {
            dur: duration + 's',
            begin: (-offsetFraction * duration) + 's',
            repeatCount: 'indefinite',
            rotate: 'auto',
        });
        if (reversed) {
            motion.setAttribute('keyPoints', '1;0');
            motion.setAttribute('keyTimes', '0;1');
            motion.setAttribute('calcMode', 'linear');
        }
        motion.appendChild(svgEl('mpath', {href: '#' + pathId}));
        dot.appendChild(motion);
        g.appendChild(dot);
    }
    return g;
}

function buildFlowLineFromPath(d, kw, options = {}) {
    if (kw === null || kw === undefined) return null;
    return buildFlowDots(d, kw, options);
}

function buildFlowLine(x1, y1, x2, y2, kw, options = {}) {
    return buildFlowLineFromPath(buildFlowPath(x1, y1, x2, y2), kw, options);
}

// Echte Fotos/Illustrationen des Nutzers (shyft-power.com) statt selbst gezeichneter Formen -
// siehe www/assets/. Nur die animierten Stromfluss-Linien selbst (buildFlowLine & Co., weiter
// unten) sind weiterhin eigenes SVG, plus die drei Icons, fuer die keine Bild-Assets existieren
// (Stecker/Blitz/Sonne-Mond).
function buildFlowImage(href, cx, cy, naturalW, naturalH, targetW) {
    const targetH = targetW * (naturalH / naturalW);
    return svgEl('image', {href, x: cx - targetW / 2, y: cy - targetH / 2, width: targetW, height: targetH});
}

// Die Hausbilder haben links einen eigenen Strommasten samt Frei-/Erdleitung eingezeichnet - der
// laesst sich nicht animieren (ist Teil des Fotos). Blendet ihn per clipPath aus, damit
// stattdessen der eigene, animierbare buildPylonIcon links davor Platz hat. Geschnitten wird von
// links UND von oben (die Freileitung reicht schraeg nach oben weiter nach rechts als der
// Mast-Pfosten selbst) - beides faellt in den Bildbereich oberhalb/links vom Haus, das Haus selbst
// beginnt (Dach/First) erst weiter unten/rechts und bleibt dadurch unangetastet.
let houseClipIdCounter = 0;
function buildCroppedHouseImage(href, naturalW, naturalH, cropLeftFraction, cropTopFraction, x, y, visibleW) {
    const fullW = visibleW / (1 - cropLeftFraction);
    const fullH = fullW * (naturalH / naturalW);
    const cropTopPx = fullH * cropTopFraction;
    const imgX = x - fullW * cropLeftFraction;
    const imgY = y - cropTopPx;
    const visibleH = fullH - cropTopPx;
    // Eindeutige ID pro Aufruf (statt eines fest verdrahteten Strings) - buildEnergyFlowWidget baut
    // Desktop- UND Mobil-<svg> gleichzeitig in dasselbe Dokument (siehe dort), ein hart codierter Id
    // waere dort doppelt vergeben. Bei doppelter ID loest der Browser url(#...) auf DAS GESAMTE
    // Dokument bezogen auf, nicht pro <svg> - das Mobil-Hausbild haette dann faelschlich den
    // Zuschnitt des Desktop-Layouts benutzt (andere Koordinaten/Groesse) und der eigentlich
    // ausgeblendete Mast waere wieder sichtbar geworden.
    const clipId = 'efw-house-clip-' + (houseClipIdCounter++);
    const g = svgEl('g');
    const defs = svgEl('defs');
    const clip = svgEl('clipPath', {id: clipId});
    clip.appendChild(svgEl('rect', {x, y, width: visibleW, height: visibleH}));
    defs.appendChild(clip);
    g.appendChild(defs);
    g.appendChild(svgEl('image', {href, x: imgX, y: imgY, width: fullW, height: fullH, 'clip-path': `url(#${clipId})`}));
    return {group: g, height: visibleH};
}

function buildGroundShadow(cx, cy, rx, ry) {
    return svgEl('ellipse', {cx, cy, rx, ry, fill: 'rgba(20, 30, 20, 0.16)'});
}

// Eigener, animierbarer Strommast (statt des im Hausbild eingezeichneten) - siehe buildCroppedHouseImage.
function buildPylonIcon(cx, cy) {
    const g = svgEl('g');
    g.appendChild(buildGroundShadow(cx, cy + 42, 26, 7));
    const lines = svgEl('g', {stroke: 'var(--flow-metal-dark)', 'stroke-width': 2.2, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'});
    lines.appendChild(svgEl('path', {d: `M ${cx - 20},${cy + 40} L ${cx - 4},${cy - 42} L ${cx + 4},${cy - 42} L ${cx + 20},${cy + 40}`}));
    for (const [yTop, yBot] of [[-42, -18], [-18, 8], [8, 34]]) {
        const wTop = 4 + (yTop + 42) / 82 * 16, wBot = 4 + (yBot + 42) / 82 * 16;
        lines.appendChild(svgEl('path', {d: `M ${cx - wTop},${cy + yTop} L ${cx + wBot},${cy + yBot} M ${cx + wTop},${cy + yTop} L ${cx - wBot},${cy + yBot}`}));
    }
    lines.appendChild(svgEl('line', {x1: cx - 26, y1: cy - 44, x2: cx + 26, y2: cy - 44}));
    g.appendChild(lines);
    for (const dx of [-26, 0, 26]) {
        g.appendChild(svgEl('circle', {cx: cx + dx, cy: cy - 44, r: 2.4, fill: 'var(--flow-metal-light)', stroke: 'var(--flow-metal-dark)', 'stroke-width': 1}));
    }
    return g;
}

function formatTemp(value) {
    if (value === null || value === undefined) return '–';
    return value.toLocaleString('de-DE', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + ' °C';
}

// Die Batterie-Bilder existieren nur in 5 festen Stufen - auf die naeheste runden statt zu interpolieren.
const BATTERY_IMAGE_BUCKETS = [
    {soc: 10, href: 'assets/battery-10.jpg'},
    {soc: 40, href: 'assets/battery-40.jpg'},
    {soc: 60, href: 'assets/battery-60.png'},
    {soc: 80, href: 'assets/battery-80.png'},
    {soc: 100, href: 'assets/battery-100.png'},
];

function batteryImageFor(socPercent) {
    const soc = socPercent ?? 0;
    return BATTERY_IMAGE_BUCKETS.reduce((closest, b) => Math.abs(b.soc - soc) < Math.abs(closest.soc - soc) ? b : closest).href;
}

// Welche Hausgrafik gezeigt wird, haengt nur davon ab, ob PV bzw. Batterie konfiguriert sind (die
// beiden sind direkt im Bild eingezeichnet) - Auto/Waermepumpe/Sonstiges erscheinen nie im
// Hausbild selbst, sondern als eigene Bilder/Icons daneben.
function houseImageFor(data) {
    const pv = !!(data.pv && data.pv.configured);
    const battery = !!(data.battery && data.battery.configured);
    if (pv && battery) return {href: 'assets/house-pv-battery.jpg', w: 1296, h: 810};
    if (pv) return {href: 'assets/house-pv.jpg', w: 962, h: 598};
    return {href: 'assets/house-none.png', w: 962, h: 598};
}

// scale 2.4 bringt die Groesse in etwa auf Augenhoehe mit den anderen Verbraucher-Icons (Bilder,
// 80-130px Zielbreite) - das schematisch gezeichnete Steckersymbol wirkte vorher winzig daneben.
function buildPlugIcon(cx, cy, on, scale = 2.4) {
    // Feste (nicht theme-abhaengige) Farbe fuer den Aus-Zustand - das Widget bleibt immer hell
    // (siehe .energyFlowWidget), var(--color-text-secondary) waere im Dark Mode zu blass dafuer.
    const color = on ? 'var(--color-accent)' : '#8b95ab';
    const g = svgEl('g', {opacity: on ? 1 : 0.45, transform: `translate(${cx},${cy}) scale(${scale}) translate(${-cx},${-cy})`});
    g.appendChild(svgEl('rect', {x: cx - 11, y: cy - 12, width: 22, height: 20, rx: 6, fill: 'var(--flow-metal-light)', stroke: color, 'stroke-width': 2}));
    for (const dx of [-4, 4]) {
        g.appendChild(svgEl('circle', {cx: cx + dx, cy: cy - 4, r: 1.8, fill: color}));
    }
    g.appendChild(svgEl('path', {d: `M ${cx},${cy + 8} q 0,10 8,10`, stroke: color, 'stroke-width': 2.5, fill: 'none', 'stroke-linecap': 'round'}));
    return g;
}

function buildLightningIcon(cx, cy) {
    return svgEl('path', {
        d: `M ${cx - 4},${cy - 12} L ${cx - 10},${cy + 2} L ${cx - 2},${cy + 2} L ${cx - 6},${cy + 14} L ${cx + 10},${cy - 3} L ${cx + 2},${cy - 3} Z`,
        fill: 'var(--color-accent)', stroke: 'var(--flow-metal-dark)', 'stroke-width': 0.6, 'stroke-linejoin': 'round',
    });
}

// Himmels-Icon ueber dem Haus: bei klarem Himmel (oder wenn keine Wetterdaten vorliegen) die
// gezeichnete Sonne bzw. der Mond je nach Uhrzeit; sonst das Emoji des aktuellen open-meteo-
// Wettercodes (currentWeatherCode, gesetzt in loadDashboard - dieselbe Zuordnung wie der
// Wetter-Streifen, siehe weatherCodeemoji).
function renderSkyIcon(cx, cy) {
    const hour = new Date().getHours();
    const isDaytime = hour >= 6 && hour < 20;
    const code = currentWeatherCode;

    // 0 = klar, 1 = ueberwiegend klar -> weiterhin die gezeichnete Sonne/Mond (passt optisch besser
    // als ein Emoji und entspricht der bisherigen Darstellung)
    if (code === null || code === undefined || code === 0 || (isDaytime && code === 1)) {
        return renderDrawnSunOrMoon(cx, cy, isDaytime);
    }

    const g = svgEl('g');
    const text = svgEl('text', {
        x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 46,
    });
    text.textContent = weatherCodeemoji(code) || (isDaytime ? '☀️' : '🌙');
    g.appendChild(text);
    return g;
}

function renderDrawnSunOrMoon(cx, cy, isDaytime) {
    const g = svgEl('g');
    if (isDaytime) {
        g.appendChild(svgEl('circle', {cx, cy, r: 20, fill: '#f4c542'}));
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * 2 * Math.PI;
            const x1 = cx + Math.cos(angle) * 27, y1 = cy + Math.sin(angle) * 27;
            const x2 = cx + Math.cos(angle) * 35, y2 = cy + Math.sin(angle) * 35;
            g.appendChild(svgEl('line', {x1, y1, x2, y2, stroke: '#f4c542', 'stroke-width': 3, 'stroke-linecap': 'round'}));
        }
    } else {
        // Mond als zwei volle Kreise mit fill-rule evenodd (der kleinere, leicht nach rechts
        // versetzte Kreis "stanzt" die Sichel aus) - robuster als ein Zwei-Bogen-Pfad, bei dem der
        // zweite Radius kleiner als der halbe Punktabstand war (SVG skaliert einen zu kleinen
        // Bogenradius automatisch hoch, wodurch die Sichel vorher unsichtbar wurde)
        const R = 20, r = 15.5, offset = 10;
        g.appendChild(svgEl('path', {
            'fill-rule': 'evenodd',
            fill: '#c9d3e8',
            d: `M ${cx - R},${cy} a ${R} ${R} 0 1 0 ${2 * R} 0 a ${R} ${R} 0 1 0 ${-2 * R} 0 Z
                M ${cx + offset - r},${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`,
        }));
        for (const [dx, dy] of [[31, -14], [40, 6], [26, 17]]) {
            g.appendChild(svgEl('circle', {cx: cx + dx, cy: cy + dy, r: 2, fill: '#c9d3e8'}));
        }
    }
    return g;
}

// Zeilenhoehe (px) von .energyFlowLabel (siehe index.html) - Basis fuer die vertikale Zentrierung
// mehrzeiliger Labels in buildEnergyFlowLabel. FLOW_LABEL_BASELINE_ADJUST gleicht aus, dass eine
// SVG-Text-y-Koordinate die Baseline meint, nicht die optische Mitte der Schrift (empirisch
// ermittelt, vorher schon so fuer die Batterie-Beschriftung verwendet).
const FLOW_LABEL_LINE_HEIGHT = 14;
// Der tatsaechliche Zeilenabstand ist 1.2em (siehe dy weiter unten) - 14 passt zur Desktop-Schrift
// (13px * 1.2 = 15.6, gerundet 14 als Kompromiss). Das Mobil-Layout hat eine deutlich groessere
// Schrift (18px, siehe .energyFlowLabel-Media-Query in index.html) und braucht deshalb ihren
// eigenen, groesseren Wert (18 * 1.2 = 21.6) - siehe buildEnergyFlowSvgMobile.
const MOBILE_FLOW_LABEL_LINE_HEIGHT = 22;
const FLOW_LABEL_BASELINE_ADJUST = 4;
// Gemeinsamer Abstand ueber der jeweiligen (horizontalen) Stromleitung fuer Grid- und
// Eigenverbrauchs-Beschriftung - beide Leitungen liegen auf derselben Hoehe (pylonCy === houseCy),
// mit demselben Gap landen ihre Labels dadurch auch auf derselben Hoehe.
const FLOW_LINE_LABEL_GAP = 24;

// Ein "(HH:MM)"- bzw. "(D.M. HH:MM)"-Zeitstempel-Suffix (siehe withStaleness/formatTimeHHMM - Datum
// wird ergaenzt, wenn der Zeitstempel nicht von heute ist) bricht auf eine eigene Zeile um, statt die
// Zeile beliebig lang werden zu lassen - sonst laufen laengere Werte (z.B. "Ladestand: 36 % (183 km)
// (28.8. 09:17)") ueber den verfuegbaren Platz neben dem Geraete-Icon hinaus. Eigene Funktion (statt
// nur Teil von buildEnergyFlowLabel), damit buildEnergyFlowSvgMobile die resultierende Zeilenzahl
// schon VOR dem eigentlichen Bauen kennt (siehe placeLabelBelow dort) - fuer die Restplatz-Berechnung
// unterhalb eines Geraete-Icons.
function wrapEnergyFlowLines(lines) {
    return lines.flatMap(line => {
        const match = /^(.*) (\((?:\d{1,2}\.\d{1,2}\.\s)?\d{2}:\d{2}\))$/.exec(line);
        return match ? [match[1], match[2]] : [line];
    });
}

function buildEnergyFlowLabel(x, centerY, lines, {anchor = 'start', noWrap = false, lineHeight = FLOW_LABEL_LINE_HEIGHT} = {}) {
    // noWrap ueberspringt das Umbrechen: fuer die vier reinen Leistungswerte an den Stromleitungen
    // (Grid/PV/Eigenverbrauch/Batterie) ist neben dem Wert genug Platz, dort soll der Zeitstempel in
    // derselben Zeile stehen statt darunter.
    const wrappedLines = noWrap ? lines : wrapEnergyFlowLines(lines);
    // centerY ist die Mitte der zugehoerigen Stromleitung (bzw. des Geraete-Icons auf ihr) - der
    // gesamte, ggf. mehrzeilige Textblock wird darum zentriert, statt centerY als Anker der ERSTEN
    // Zeile zu behandeln. Sonst haengt die sichtbare Hoehe eines Labels davon ab, ob es (z.B. durch
    // einen zusaetzlichen Zeitstempel bei veralteten Sensorwerten) ein- oder zweizeilig ist, und
    // zwei Labels an derselben Leitung/Hoehe koennten je nach Zeilenzahl unterschiedlich hoch
    // erscheinen. lineHeight muss zum tatsaechlichen Zeilenabstand passen (dy: 1.2em weiter unten,
    // also 1.2 * aktuelle .energyFlowLabel-Schriftgroesse) - der Default passt zur Desktop-Schrift
    // (13px), das Mobil-Layout ist deutlich groesser (18px) und muss deshalb einen groesseren Wert
    // uebergeben (siehe MOBILE_FLOW_LABEL_LINE_HEIGHT), sonst rutschen mehrzeilige Bloecke ineinander.
    const startY = centerY - ((wrappedLines.length - 1) * lineHeight) / 2 + FLOW_LABEL_BASELINE_ADJUST;
    const text = svgEl('text', {x, y: startY, 'text-anchor': anchor, class: 'energyFlowLabel'});
    // dy in em (relativ zur aktuellen Schriftgroesse) statt fest 14px - so bleibt der Zeilenabstand
    // korrekt, wenn .energyFlowLabel die Schriftgroesse per Media Query fuer mobile aendert (siehe
    // index.html), statt dass sich mehrzeilige Labels dann ueberlappen.
    wrappedLines.forEach((line, i) => {
        text.appendChild(svgEl('tspan', {x, dy: i === 0 ? 0 : '1.2em'}, [document.createTextNode(line)]));
    });
    return text;
}

// Schwellwerte (Minuten), ab denen ein Sensorwert im Widget als "veraltet" gilt und sein
// Zeitstempel eingeblendet wird - 1 Minute fuer die direkten Wechselrichter-Fluesse (Grid/
// Household/Battery/PV), 10 Minuten fuer alle uebrigen HA-Sensorwerte im Bild (Waermepumpe, Auto
// etc.). Werte, die nicht direkt aus HA kommen (z.B. der Strompreis), bekommen gar keinen
// Zeitstempel - dafuer withStaleness einfach nicht aufrufen.
const INVERTER_STALE_MINUTES = 1;
const OTHER_STALE_MINUTES = 10;

function isStale(updatedAtIso, thresholdMinutes) {
    if (!updatedAtIso) return false;
    const updatedAt = new Date(updatedAtIso);
    if (Number.isNaN(updatedAt.getTime())) return false;
    return (Date.now() - updatedAt.getTime()) / 60000 > thresholdMinutes;
}

function formatTimeHHMM(updatedAtIso) {
    const d = new Date(updatedAtIso);
    if (Number.isNaN(d.getTime())) return '';
    const time = d.toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'});
    const now = new Date();
    const isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    if (isToday) return time;
    // Nicht vom heutigen Tag - Datum ergaenzen (z.B. "28.8. 17:01"), sonst wirkt ein alter
    // Zeitstempel wie einer von heute morgen frueh. de-DE haengt bei numeric/numeric bereits einen
    // Punkt an ("28.8."), daher hier kein zusaetzlicher davor.
    const date = d.toLocaleDateString('de-DE', {day: 'numeric', month: 'numeric'});
    return `${date} ${time}`;
}

// Haengt " (HH:MM)" an valueText an, wenn der zugehoerige HA-Sensor (updatedAtIso, siehe
// compute_energy_flow_data in app.py) aelter als thresholdMinutes ist - sonst valueText
// unveraendert.
function withStaleness(valueText, updatedAtIso, thresholdMinutes) {
    if (!isStale(updatedAtIso, thresholdMinutes)) return valueText;
    return `${valueText} (${formatTimeHHMM(updatedAtIso)})`;
}

// Fluss-Groessen der vier "rechten"/"unteren" Verbraucher (Waermepumpe/Auto/Sonstiges Geraet/
// Haushaltsstrom) - von Desktop- UND Mobil-Layout gemeinsam genutzt (siehe buildEnergyFlowSvgDesktop/
// buildEnergyFlowWidgetMobile), da beide dieselbe Logik brauchen, nur mit unterschiedlicher Geometrie.
function computeEnergyFlowKw(data) {
    const heatpumpOn = !!(data.heatpump && data.heatpump.configured && data.heatpump.on);
    const carCharging = !!(data.car && data.car.configured && data.car.state === 'charging');
    const sonstigerOn = !!(data.sonstigerVerbraucher && data.sonstigerVerbraucher.configured && data.sonstigerVerbraucher.on);
    return {
        heatpumpOn,
        heatpumpFlowKw: heatpumpOn ? (data.heatpump.kw || 0.3) : 0,
        carCharging,
        carFlowKw: carCharging ? (data.car.chargingKw || 0.5) : 0,
        sonstigerOn,
        sonstigerFlowKw: sonstigerOn ? 0.3 : 0,
        householdFlowKw: (data.household && data.household.configured) ? (data.household.residualKw ?? 0.1) : 0,
    };
}

// Baut nur das eigentliche Desktop-<svg> (siehe buildEnergyFlowWidget fuer den gemeinsamen Wrapper
// mit dem Mobil-Pendant buildEnergyFlowWidgetMobile).
function buildEnergyFlowSvgDesktop(data) {
    // Breiter als hoch (statt quadratischer 940x560) - das Haus steht jetzt mittig, links bleibt
    // Platz fuer den Netz-Anschluss, rechts fuer die Verbraucher-Spalte samt ihrer (teils mehrzeiligen)
    // Labels, ohne dass beide Seiten sich in die Quere kommen.
    // VIEW_W von 1100 auf 1300 erhoeht (siehe auch der groessere busX->columnX-Abstand unten) - bei
    // 1100 ragten breitere Geraete-Icons (v.a. das 130px breite Auto-Bild) links in den senkrechten
    // Verbraucher-Bus hinein statt sichtbar rechts davon abgesetzt zu stehen.
    const VIEW_W = 1300, VIEW_H = 560;
    const svg = svgEl('svg', {viewBox: `0 0 ${VIEW_W} ${VIEW_H}`});

    // Haus: der im Bild eingezeichnete Strommast/die Leitung laesst sich nicht animieren - wird
    // per Crop ausgeblendet (siehe buildCroppedHouseImage), der eigene buildPylonIcon uebernimmt
    // seinen Platz links davor. PV und Batterie sind im Bild bereits eingezeichnet, Grid/PV/
    // Haushalt bekommen deshalb reine Text-Label statt einer eigenen Animations-Linie zum Haus.
    const house = houseImageFor(data);
    // Mast+Freileitung im Bild werden per Crop ausgeblendet: von links (entfernt Mast-Pfosten +
    // das gruene Erdkabel zum Zaehlerkasten) UND von oben (entfernt die schraeg nach oben
    // laufenden Freileitungen, die weiter nach rechts reichen als der Mast selbst) - eine einzelne
    // Ecke lässt sich mit einem Rechteck ausblenden, ohne das Haus selbst anzuschneiden, weil
    // Hausdach/-wand erst bei einer groesseren y-Koordinate (weiter unten) beginnen als die
    // Freileitungen enden.
    // Werte per Pixelanalyse des Originalbilds ermittelt (nicht mehr geschaetzt): Hauswand beginnt
    // bei ca. 43,6% Bildbreite, Dachfirst bei ca. 37% Bildhoehe - 0.40/0.28 lassen Mast, Freileitung
    // und Baum vollstaendig verschwinden, ohne das Haus selbst anzuschneiden (mit Sicherheitsabstand).
    const houseCropLeftFraction = 0.40, houseCropTopFraction = 0.28;
    const houseVisibleW = 230;
    // houseH vorab berechnet (dieselbe Formel wie in buildCroppedHouseImage) - wird gebraucht, um
    // das Haus auch vertikal zu zentrieren, bevor wir es platzieren (nicht erst danach, siehe
    // cropped.height weiter unten, die denselben Wert liefert).
    const houseFullW = houseVisibleW / (1 - houseCropLeftFraction);
    const houseFullH = houseFullW * (house.h / house.w);
    const houseH = houseFullH - houseFullH * houseCropTopFraction;
    // Haus mittig in der Grafik (horizontal UND vertikal) - alle anderen Elemente richten sich
    // relativ dazu aus (Sonne/Batterie senkrecht ueber/unter dem Haus-Mittelpunkt).
    const houseCx = VIEW_W / 2, houseCy = VIEW_H / 2;
    const houseX = houseCx - houseVisibleW / 2, houseY = houseCy - houseH / 2;
    const cropped = buildCroppedHouseImage(house.href, house.w, house.h, houseCropLeftFraction, houseCropTopFraction, houseX, houseY, houseVisibleW);
    svg.appendChild(cropped.group);

    // Deutlich mehr Abstand zum Haus als vorher, und groesser (siehe renderSkyIcon).
    const sunCy = houseY - 95;
    svg.appendChild(renderSkyIcon(houseCx, sunCy));

    // Fluss-Groessen der vier rechten Verbraucher vorab bestimmen (statt wie frueher erst weiter
    // unten, im jeweils eigenen Block) - der Trunk (Haus -> Knotenpunkt, siehe busX unten) braucht
    // sie schon fuer seine eigene, gemeinsame Punkte-Animation, bevor die einzelnen Zweige gezeichnet
    // werden.
    const {heatpumpFlowKw, carCharging, carFlowKw, sonstigerOn, sonstigerFlowKw, householdFlowKw} = computeEnergyFlowKw(data);

    if (data.grid && data.grid.configured) {
        const pylonCx = houseX - 135, pylonCy = houseCy;
        // Mast-Abstand zum Haus jetzt genauso gross wie Haus-Abstand zum Verbraucher-Knotenpunkt
        // (busX unten, ebenfalls 135) statt fest bei 90 - der ungenutzte linke Rand wird per
        // Crop aus dem viewBox entfernt (siehe svg.setAttribute weiter unten), die Grafik wird
        // dadurch insgesamt schmaler.
        svg.appendChild(buildPylonIcon(pylonCx, pylonCy));
        // Bagatellgrenze 0.1 kW (absolut): darunter bleibt die Leitung sichtbar, aber grau/inaktiv
        // statt einen kaum vorhandenen Fluss zu animieren.
        const line = buildFlowLine(pylonCx + 24, pylonCy, houseX, houseCy, data.grid.kw, {reversed: (data.grid.kw || 0) < 0, thresholdKw: 0.1});
        if (line) svg.appendChild(line);
        // Feste Farben statt der theme-abhaengigen --color-error/--color-text-secondary - das
        // Widget bleibt immer hell (siehe .energyFlowWidget), Dark-Mode-Toene waeren hier blass.
        const priceColor = data.grid.priceLevel === 'hoch' ? '#e74c3c' : data.grid.priceLevel === 'niedrig' ? 'var(--color-accent)' : '#5b6b8c';
        const priceText = data.grid.priceCent !== null ? `${data.grid.priceCent.toLocaleString('de-DE')} Cent` : '';
        // kW-Wert mittig ueber der Leitung (horizontaler Fluss -> Beschriftung ueber der Leitung),
        // Mittelpunkt der Strecke Mast->Haus. Der Strompreis bleibt dagegen wie urspruenglich ueber
        // dem Mast selbst - er ist kein Leitungs-Fluesswert, sondern eine dem Mast zugeordnete
        // Zusatzinfo.
        const gridLabelX = (pylonCx + 24 + houseX) / 2;
        svg.appendChild(buildEnergyFlowLabel(gridLabelX, pylonCy - FLOW_LINE_LABEL_GAP, [withStaleness(formatKwValue(data.grid.kw), data.grid.updatedAt, INVERTER_STALE_MINUTES)], {anchor: 'middle', noWrap: true}));
        if (priceText) {
            // Kein Zeitstempel hier - der Strompreis kommt nicht direkt aus HA (siehe
            // _read_current_price_info in app.py), sondern aus dem shyft-Cache.
            svg.appendChild(svgEl('text', {x: pylonCx, y: pylonCy - 54, 'text-anchor': 'middle', class: 'energyFlowLabel', fill: priceColor}, [document.createTextNode(priceText)]));
        }
    }
    if (data.pv && data.pv.configured) {
        // Leitung Sonne/Mond -> Haus: wie bei allen anderen Fluessen bleibt sie (grau, ohne Punkte)
        // auch bei 0 kW sichtbar (siehe buildFlowLine/buildFlowDots) statt bei fehlendem PV-Ertrag
        // (z.B. nachts) ganz zu verschwinden. 45px Abstand unter sunCy, damit die Leitung nicht in
        // die Sonnenstrahlen bzw. den Mond hineinragt (aeusserer Radius dort ca. 35px).
        const pvLineTopY = sunCy + 45, pvLineBottomY = houseY;
        const pvLine = buildFlowLine(houseCx, pvLineTopY, houseCx, pvLineBottomY, data.pv.kw);
        if (pvLine) svg.appendChild(pvLine);
        const pvLineCenterY = (pvLineTopY + pvLineBottomY) / 2;
        svg.appendChild(buildEnergyFlowLabel(houseCx + 30, pvLineCenterY, [withStaleness(formatKwValue(data.pv.kw), data.pv.updatedAt, INVERTER_STALE_MINUTES)], {noWrap: true}));
    }

    if (data.battery && data.battery.configured) {
        // Unterhalb des Hauses statt daneben - sonst ueberschneidet sich die Linie mit dem
        // Verbraucher-Bus (siehe unten), der auf gleicher Hoehe vom Haus abgeht
        const batteryImgW = 42, batteryImgH = batteryImgW / 0.535;
        // Deutlich mehr Abstand zum Haus als vorher (60 statt 20).
        const batteryGap = 60;
        const batteryCx = houseCx, batteryCy = houseY + houseH + batteryGap + batteryImgH / 2;
        const batteryLineTopY = houseY + houseH, batteryLineBottomY = batteryCy - batteryImgH / 2 - 4;
        const line = buildFlowLine(houseCx, batteryLineTopY, batteryCx, batteryLineBottomY, data.battery.kw, {reversed: (data.battery.kw || 0) < 0});
        if (line) svg.appendChild(line);
        svg.appendChild(buildFlowImage(batteryImageFor(data.battery.soc), batteryCx, batteryCy, 240, 448, batteryImgW));
        // kW-Wert an der Leitung selbst (vertikal mittig darauf, wie Grid/PV/Eigenverbrauch) - der
        // Zeitstempel steht bei Bedarf daneben statt darunter (noWrap), hier ist genug Platz dafuer.
        const batteryLineCenterY = (batteryLineTopY + batteryLineBottomY) / 2;
        svg.appendChild(buildEnergyFlowLabel(batteryCx + batteryImgW / 2 + 10, batteryLineCenterY, [withStaleness(formatKwValue(data.battery.kw), data.battery.updatedAt, INVERTER_STALE_MINUTES)], {noWrap: true}));
        // SOC + Modus dagegen weiterhin neben dem Icon selbst (nicht an der Leitung) - das war schon
        // richtig so, nur der kW-Wert gehoert an die Leitung.
        const batterySocModeLines = [`${Math.round(data.battery.soc ?? 0)} %`];
        if (data.battery.mode) batterySocModeLines.push(data.battery.mode);
        svg.appendChild(buildEnergyFlowLabel(batteryCx + batteryImgW / 2 + 10, batteryCy, batterySocModeLines));
    }

    const houseRightX = houseX + houseVisibleW;
    // Gemeinsamer Bus "Haus -> Verbraucher": alle vier rechten Verbraucher gehen vom selben
    // Hausaustrittspunkt ab und teilen sich eine senkrechte Spalte (der "Trunk"), bevor sie zur
    // jeweiligen Reihe abzweigen - so laeuft z.B. die Waermepumpen-Leitung nicht quer durchs
    // Wallbox-Icon. Trunk kurz (Haus ist ja jetzt zentriert, direkt daneben), individuelle Leitungen
    // von busX bis dicht ans jeweilige Geraet-Icon heran entsprechend laenger.
    const busX = houseRightX + 135;
    // 110 statt vorher 30 - bei 30 ragte das 130px breite Auto-Bild (columnX +/-65) mit seiner
    // linken Haelfte in den senkrechten Bus (busX) hinein, statt sichtbar rechts davon abgesetzt zu
    // stehen. 110 laesst selbst dem breitesten Geraete-Icon (Auto) noch reichlich Abstand zur Leitung.
    const columnX = busX + 110;
    const consumerAnchorX = columnX - 10;
    // Reihen symmetrisch um houseCy verteilt (Hausmitte liegt jetzt zwischen den Reihen), statt
    // wie vorher alle unterhalb des - damals houseCy-nahen - Hausoberkante.
    const rowYHeatpump = houseCy - 180, rowYCar = houseCy - 60, rowYOther = houseCy + 60, rowYHousehold = houseCy + 180;
    const trunkTopY = Math.min(rowYHeatpump, rowYCar, rowYOther, rowYHousehold);
    const trunkBottomY = Math.max(rowYHeatpump, rowYCar, rowYOther, rowYHousehold);
    // Der Trunk (Haus -> Knotenpunkt -> obere/untere Haelfte des Verbraucher-Bus) bekommt jetzt
    // wieder eine eigene, durchgehende Punkte-Animation, statt komplett statisch/punktlos zu sein.
    // Anders als vorher NICHT mehr eine einzige Linie ueber die volle Bus-Hoehe (das erzwang eine
    // Fliessrichtung fuer alle vier Zweige gleichzeitig, obwohl die obere Haelfte "nach oben" und
    // die untere "nach unten" abzweigt) - stattdessen 3 Segmente, jedes mit seiner eigenen,
    // plausiblen Geschwindigkeit: der horizontale Hausaustritt (Summe aller aktiven Verbraucher),
    // sowie je ein Segment vom Knotenpunkt nach oben (Waermepumpe+Auto) bzw. nach unten
    // (Sonstiges+Haushaltsstrom).
    const trunkKw = heatpumpFlowKw + carFlowKw + sonstigerFlowKw + householdFlowKw;
    const trunkLine = buildFlowLineFromPath(buildFlowPath(houseRightX, houseCy, busX, houseCy), trunkKw, {thresholdKw: 0.1});
    if (trunkLine) svg.appendChild(trunkLine);
    const upperSpineKw = heatpumpFlowKw + carFlowKw;
    const upperSpine = buildFlowLineFromPath(`M ${busX},${houseCy} V ${trunkTopY}`, upperSpineKw, {thresholdKw: 0.1});
    if (upperSpine) svg.appendChild(upperSpine);
    const lowerSpineKw = sonstigerFlowKw + householdFlowKw;
    const lowerSpine = buildFlowLineFromPath(`M ${busX},${houseCy} V ${trunkBottomY}`, lowerSpineKw, {thresholdKw: 0.1});
    if (lowerSpine) svg.appendChild(lowerSpine);
    // Der Haushaltsstrom-Wert (Gesamt-Hausverbrauch) gehoert auf diesen Trunk, nicht auf den
    // separaten Zweig unten - dort steht ohnehin nur der Rest-Anteil (residualKw), der die
    // Wallbox-/Waermepumpen-Leistung schon herausrechnet.
    if (data.household && data.household.configured) {
        const trunkLabelX = (houseRightX + busX) / 2;
        // Gleicher Gap wie beim Grid-Label (FLOW_LINE_LABEL_GAP) - Grid- und Trunk-Leitung liegen auf
        // derselben Hoehe (houseCy === pylonCy), damit landen auch beide Beschriftungen auf derselben
        // Hoehe, statt (wie vorher) mit unterschiedlichen Offsets leicht versetzt zu wirken.
        svg.appendChild(buildEnergyFlowLabel(trunkLabelX, houseCy - FLOW_LINE_LABEL_GAP, [withStaleness(formatKwValue(data.household.kw), data.household.updatedAt, INVERTER_STALE_MINUTES)], {anchor: 'middle', noWrap: true}));
    }

    if (data.heatpump && data.heatpump.configured) {
        const rowY = rowYHeatpump;
        // Leitung immer sichtbar (grau, siehe buildFlowDots), Punkte nur wenn sie tatsaechlich
        // laeuft - sonst wirkt es so, als flösse Strom zu einem ausgeschalteten Geraet.
        const line = buildFlowLineFromPath(buildFlowPath(busX, rowY, consumerAnchorX, rowY), heatpumpFlowKw);
        if (line) svg.appendChild(line);
        const hp = buildFlowImage('assets/heatpump.jpg', columnX, rowY, 499, 492, 80);
        if (data.heatpump.on) hp.setAttribute('class', 'energyFlowPulse');
        svg.appendChild(hp);
        const statusLines = [
            withStaleness(data.heatpump.on === null ? 'Wärmepumpe' : (data.heatpump.on ? 'An' : 'Aus'), data.heatpump.updatedAt, OTHER_STALE_MINUTES),
            data.heatpump.targetTempC !== null ? `Soll: ${formatTemp(data.heatpump.targetTempC)}` : null,
            data.indoorTemp && data.indoorTemp.configured && data.indoorTemp.tempC !== null ? withStaleness(`Ist: ${formatTemp(data.indoorTemp.tempC)}`, data.indoorTemp.updatedAt, OTHER_STALE_MINUTES) : null,
            data.heatpump.dhwTankTempC !== null ? `WW-Speicher: ${formatTemp(data.heatpump.dhwTankTempC)}` : null,
            (data.heatpump.heatingOn !== null || data.heatpump.supplyTempC !== null)
                ? `Heizung: ${data.heatpump.heatingOn ? 'An' : 'Aus'}` + (data.heatpump.supplyTempC !== null ? ` (${formatTemp(data.heatpump.supplyTempC)})` : '')
                : null,
        ].filter(Boolean);
        // Vertikal mittig an der Leitung/dem Icon (rowY) statt an einem festen Offset - so bleibt die
        // Beschriftung auf Leitungshoehe, egal wie viele der optionalen statusLines gerade anfallen.
        svg.appendChild(buildEnergyFlowLabel(columnX + 46, rowY, statusLines));
    }

    if (data.car && data.car.configured) {
        const rowY = rowYCar;
        const isAway = data.car.state === 'away';
        const isCharging = carCharging;
        // Leitung immer sichtbar (auch "abwesend"), Punkte nur waehrend des Ladens.
        const line = buildFlowLineFromPath(buildFlowPath(busX, rowY, consumerAnchorX, rowY), carFlowKw);
        if (line) svg.appendChild(line);
        // Ein Bild pro Zustand (das "verbunden"-Bild zeigt Auto+Wallbox bereits zusammen) statt
        // zweier separater Icons - siehe ev-connected.jpg/ev-away.jpg
        const carImg = isAway ? {href: 'assets/ev-away.jpg', w: 356, h: 239} : {href: 'assets/ev-connected.jpg', w: 464, h: 229};
        const carTargetW = 130;
        svg.appendChild(buildFlowImage(carImg.href, columnX, rowY, carImg.w, carImg.h, carTargetW));
        const carLines = [];
        if (data.car.soc !== null) carLines.push(withStaleness(`Ladestand: ${Math.round(data.car.soc)} %` + (data.car.rangeKm !== null ? ` (${data.car.rangeKm} km)` : ''), data.car.updatedAt, OTHER_STALE_MINUTES));
        if (data.car.state === 'away') carLines.push('abwesend');
        else if (data.car.state === 'charging') carLines.push('lädt');
        else if (data.car.state === 'connected') carLines.push('eingesteckt');
        svg.appendChild(buildEnergyFlowLabel(columnX + carTargetW / 2 + 10, rowY, carLines));
    }

    if (data.sonstigerVerbraucher && data.sonstigerVerbraucher.configured) {
        const rowY = rowYOther;
        const on = sonstigerOn;
        // Groesse des Stecker-Icons (siehe buildPlugIcon) - Leitungsende und Label-Start muessen
        // sich danach richten, sonst laufen beide ins vergroesserte Icon hinein statt daneben.
        const plugScale = 2.4, plugHalfWidth = 11 * plugScale;
        // Leitung immer sichtbar; kein Leistungssensor fuer "Sonstiger Verbraucher" vorgesehen (nur
        // an/aus) - fester Platzhalterwert nur fuer eine plausible Punkte-Geschwindigkeit, wenn an.
        const line = buildFlowLineFromPath(buildFlowPath(busX, rowY, columnX - plugHalfWidth - 6, rowY), sonstigerFlowKw);
        if (line) svg.appendChild(line);
        svg.appendChild(buildPlugIcon(columnX, rowY, on, plugScale));
        svg.appendChild(buildEnergyFlowLabel(columnX + plugHalfWidth + 10, rowY, ['Sonstiges Gerät']));
    }

    if (data.household && data.household.configured) {
        const rowY = rowYHousehold;
        const line = buildFlowLineFromPath(buildFlowPath(busX, rowY, consumerAnchorX, rowY), householdFlowKw);
        if (line) svg.appendChild(line);
        svg.appendChild(buildLightningIcon(columnX, rowY));
        svg.appendChild(buildEnergyFlowLabel(columnX + 24, rowY, ['Haushaltsstrom']));
    }

    // Ungenutzten linken Rand wegschneiden, der durch den naeher heranger ueckten Mast frei wurde
    // (siehe pylonCx oben) - verschiebt nur den viewBox-Ursprung nach rechts, alle Koordinaten
    // rechts davon (Haus, Bus, Verbraucher-Spalte) bleiben unveraendert gueltig.
    const viewCropLeft = Math.max(0, (houseX - 135) - 90);
    svg.setAttribute('viewBox', `${viewCropLeft} 0 ${VIEW_W - viewCropLeft} ${VIEW_H}`);

    return svg;
}

// Wie buildEnergyFlowLabel, aber fuer Labels, die UNTERHALB eines festen Punkts (Geraete-Icon) nach
// unten wachsen sollen, statt um eine Mitte zentriert zu werden - buildEnergyFlowLabel zentriert den
// gesamten (ggf. durch einen Zeitstempel umgebrochenen) Textblock um centerY, hier kennen wir aber
// erst den TOP-Punkt (Icon-Unterkante + Abstand) und wollen den Block von dort abwaerts wachsen
// lassen. Gibt zusaetzlich bottomY zurueck (fuer die dynamische viewBox-Hoehe des Mobil-Layouts,
// siehe buildEnergyFlowSvgMobile).
function placeLabelBelow(x, topY, lines, opts = {}) {
    const lineHeight = opts.lineHeight || FLOW_LABEL_LINE_HEIGHT;
    const wrapped = wrapEnergyFlowLines(lines);
    const centerY = topY + ((wrapped.length - 1) * lineHeight) / 2;
    const bottomY = topY + (wrapped.length - 1) * lineHeight + FLOW_LABEL_BASELINE_ADJUST + 8;
    return {el: buildEnergyFlowLabel(x, centerY, lines, opts), bottomY};
}

// Mobil-Layout: schmaler und hochkant statt breit (buildEnergyFlowSvgDesktop), damit bei derselben
// Containerbreite mehr Bildschirmpixel pro SVG-Einheit zur Verfuegung stehen (= groesserer, lesbarer
// Text - siehe .energyFlowLabel-Media-Query in index.html) statt auf einem schmalen Screen unleserlich
// klein zu skalieren. Layout gegenueber Desktop gedreht: Batterie steht rechts neben dem Haus (dort,
// wo auf Desktop die Verbraucher-Spalte beginnt), Waermepumpe/Auto/Sonstiges Geraet/Haushaltsstrom
// stehen dafuer nebeneinander UNTER dem Haus (statt in einer Spalte rechts) - dadurch wird die Grafik
// insgesamt schmaler, ohne Geraete wegzulassen. Aktiv unter genau der Breite, ab der .energyFlowLabel
// per Media Query vergroessert wird (siehe .energyFlowSvgMobile/.energyFlowSvgDesktop in index.html).
function buildEnergyFlowSvgMobile(data) {
    // 1150 statt z.B. 640 - mit vier vollen Verbraucher-Labels nebeneinander (Waermepumpe/Auto/
    // Sonstiges Geraet/Haushaltsstrom) reicht ein schmaleres viewBox nicht: einzelne Zeilen wie
    // "Sonstiges Gerät" oder "eingesteckt" sind bei gut lesbarer Schriftgroesse (siehe
    // .energyFlowLabel-Media-Query) schon fuer sich genommen breiter als eine schmalere Spalte
    // erlauben wuerde. Ausserdem brauchen Mast/Batterie mehr Abstand zum Haus (siehe pylonCx/
    // batteryCx) und die Beschriftungen auf den horizontalen Leitungen (Grid/Batterie) mehr Luft,
    // sonst wirkt es zu eng. 1150 ist trotzdem noch etwas schmaler als das Desktop-Layout (1300).
    const VIEW_W = 1150;
    const svg = svgEl('svg');

    const house = houseImageFor(data);
    const houseCropLeftFraction = 0.40, houseCropTopFraction = 0.28;
    const houseVisibleW = 170;
    const houseFullW = houseVisibleW / (1 - houseCropLeftFraction);
    const houseFullH = houseFullW * (house.h / house.w);
    const houseH = houseFullH - houseFullH * houseCropTopFraction;
    const houseCx = VIEW_W / 2;
    const houseY = 160;
    const houseX = houseCx - houseVisibleW / 2;
    const houseCy = houseY + houseH / 2;
    const cropped = buildCroppedHouseImage(house.href, house.w, house.h, houseCropLeftFraction, houseCropTopFraction, houseX, houseY, houseVisibleW);
    svg.appendChild(cropped.group);

    const sunCy = houseY - 90;
    svg.appendChild(renderSkyIcon(houseCx, sunCy));

    const flows = computeEnergyFlowKw(data);

    if (data.grid && data.grid.configured) {
        // 130 statt vorher 75 - bei 75 stand der Mast zu eng am Haus (siehe buildPylonIcon: der Mast
        // selbst ist schon ca. 90 breit inkl. Freileitung oben). Der Mast reicht von cy-44 (oberste
        // Freileitung) bis cy+42 (Fuss) - die kW-Beschriftung braucht deshalb deutlich mehr Abstand
        // als der generische FLOW_LINE_LABEL_GAP, sonst haengt sie in der Freileitung (siehe
        // pylonLabelGap unten), ebenso der Strompreis-Text noch darueber.
        const pylonCx = houseX - 130, pylonCy = houseCy;
        svg.appendChild(buildPylonIcon(pylonCx, pylonCy));
        const line = buildFlowLine(pylonCx + 24, pylonCy, houseX, houseCy, data.grid.kw, {reversed: (data.grid.kw || 0) < 0, thresholdKw: 0.1});
        if (line) svg.appendChild(line);
        const priceColor = data.grid.priceLevel === 'hoch' ? '#e74c3c' : data.grid.priceLevel === 'niedrig' ? 'var(--color-accent)' : '#5b6b8c';
        const priceText = data.grid.priceCent !== null ? `${data.grid.priceCent.toLocaleString('de-DE')} Cent` : '';
        const gridLabelX = (pylonCx + 24 + houseX) / 2;
        const pylonTopY = pylonCy - 44;
        const gridLabelY = pylonTopY - 16;
        svg.appendChild(buildEnergyFlowLabel(gridLabelX, gridLabelY, [withStaleness(formatKwValue(data.grid.kw), data.grid.updatedAt, INVERTER_STALE_MINUTES)], {anchor: 'middle', noWrap: true}));
        if (priceText) {
            svg.appendChild(svgEl('text', {x: pylonCx, y: gridLabelY - 26, 'text-anchor': 'middle', class: 'energyFlowLabel', fill: priceColor}, [document.createTextNode(priceText)]));
        }
    }

    if (data.pv && data.pv.configured) {
        const pvLineTopY = sunCy + 40, pvLineBottomY = houseY;
        const pvLine = buildFlowLine(houseCx, pvLineTopY, houseCx, pvLineBottomY, data.pv.kw);
        if (pvLine) svg.appendChild(pvLine);
        const pvLineCenterY = (pvLineTopY + pvLineBottomY) / 2;
        svg.appendChild(buildEnergyFlowLabel(houseCx + 26, pvLineCenterY, [withStaleness(formatKwValue(data.pv.kw), data.pv.updatedAt, INVERTER_STALE_MINUTES)], {noWrap: true}));
    }

    const houseRightX = houseX + houseVisibleW;
    // Batterie wandert auf Mobil rechts neben das Haus (horizontaler Fluss, wie Grid links) statt
    // wie auf Desktop darunter - dort unten stehen stattdessen die vier Verbraucher nebeneinander.
    if (data.battery && data.battery.configured) {
        const batteryImgW = 42, batteryImgH = batteryImgW / 0.535;
        // 130 statt vorher 95, symmetrisch zum Mast (siehe pylonCx oben) - sonst wirkt es zu eng.
        const batteryCx = houseRightX + 130, batteryCy = houseCy;
        const line = buildFlowLine(houseRightX, houseCy, batteryCx - batteryImgW / 2 - 4, houseCy, data.battery.kw, {reversed: (data.battery.kw || 0) < 0});
        if (line) svg.appendChild(line);
        svg.appendChild(buildFlowImage(batteryImageFor(data.battery.soc), batteryCx, batteryCy, 240, 448, batteryImgW));
        // kW-Wert oberhalb des Icons (mit echtem Abstand zur Icon-Oberkante, nicht der generische
        // FLOW_LINE_LABEL_GAP - der reichte bei diesem vergleichsweise hohen Batterie-Icon nicht und
        // die Beschriftung haenge sichtbar ins Icon hinein). SOC+Modus dagegen unterhalb des Icons -
        // dort ist auf Mobil mehr Platz in der Breite als seitlich neben dem Icon (dort wuerde z.B.
        // "Maximize Self Consumption" ueber den rechten Bildrand hinauslaufen).
        const batteryTopY = batteryCy - batteryImgH / 2;
        svg.appendChild(buildEnergyFlowLabel(batteryCx, batteryTopY - 16, [withStaleness(formatKwValue(data.battery.kw), data.battery.updatedAt, INVERTER_STALE_MINUTES)], {anchor: 'middle', noWrap: true}));
        const batterySocModeLines = [`${Math.round(data.battery.soc ?? 0)} %`];
        if (data.battery.mode) batterySocModeLines.push(data.battery.mode);
        svg.appendChild(placeLabelBelow(batteryCx, batteryCy + batteryImgH / 2 + 14, batterySocModeLines, {anchor: 'middle', lineHeight: MOBILE_FLOW_LABEL_LINE_HEIGHT}).el);
    }

    // Waermepumpe/Auto/Sonstiges Geraet/Haushaltsstrom nebeneinander unter dem Haus - nur die
    // tatsaechlich konfigurierten, gleichmaessig ueber die Breite verteilt (dieselbe
    // configured-Pruefung wie im Desktop-Layout, nur andere Geometrie).
    const devices = [];
    if (data.heatpump && data.heatpump.configured) devices.push('heatpump');
    if (data.car && data.car.configured) devices.push('car');
    if (data.sonstigerVerbraucher && data.sonstigerVerbraucher.configured) devices.push('sonstiger');
    if (data.household && data.household.configured) devices.push('household');

    const trunkTopY = houseY + houseH;
    let contentBottomY = trunkTopY + 20;

    if (devices.length > 0) {
        const busY = trunkTopY + 55;
        const rowY = busY + 80;
        const n = devices.length;
        const colXs = devices.map((_, i) => (VIEW_W / (n + 1)) * (i + 1));

        // Vereinfachung gegenueber dem Desktop-Spine (siehe dortiger Kommentar zu upper-/lowerSpine):
        // die gesamte waagerechte Bus-Leitung nutzt hier die Summe ALLER aktiven Zweige fuer ihre
        // Punkte-Geschwindigkeit, statt pro Segment nur die ab dort noch abzweigenden Verbraucher zu
        // zaehlen - bei bis zu 4 Spalten waere die exakte Segment-Aufteilung unverhaeltnismaessig
        // komplex fuer einen rein optischen Geschwindigkeitswert.
        const trunkKw = flows.heatpumpFlowKw + flows.carFlowKw + flows.sonstigerFlowKw + flows.householdFlowKw;
        const trunkLine = buildFlowLineFromPath(buildFlowPath(houseCx, trunkTopY, houseCx, busY), trunkKw, {thresholdKw: 0.1});
        if (trunkLine) svg.appendChild(trunkLine);
        if (n > 1) {
            const busLine = buildFlowLineFromPath(`M ${colXs[0]},${busY} H ${colXs[n - 1]}`, trunkKw, {thresholdKw: 0.1});
            if (busLine) svg.appendChild(busLine);
        }

        // Nur die Icons stehen nebeneinander (wie gewuenscht) - das volle Detail je Geraet (wie auf
        // Desktop, keine gekuerzten Werte) passt bei bis zu 4 Spalten nicht OHNE Ueberlappung darunter
        // zentriert. Stattdessen wird die Detail-Liste weiter unten fuer jedes Geraet komplett
        // untereinander geschrieben (siehe deviceDetailBlocks) - dafuer ist ja, anders als in der
        // Breite, reichlich Platz nach unten vorhanden.
        const deviceDetailBlocks = [];

        devices.forEach((type, i) => {
            const colX = colXs[i];

            if (type === 'heatpump') {
                const iconHalfH = 35;
                const drop = buildFlowLineFromPath(`M ${colX},${busY} V ${rowY - iconHalfH}`, flows.heatpumpFlowKw);
                if (drop) svg.appendChild(drop);
                const hp = buildFlowImage('assets/heatpump.jpg', colX, rowY, 499, 492, 70);
                if (data.heatpump.on) hp.setAttribute('class', 'energyFlowPulse');
                svg.appendChild(hp);
                deviceDetailBlocks.push({colX, lines: [
                    `Wärmepumpe: ${withStaleness(data.heatpump.on === null ? '–' : (data.heatpump.on ? 'An' : 'Aus'), data.heatpump.updatedAt, OTHER_STALE_MINUTES)}`,
                    data.heatpump.targetTempC !== null ? `Soll: ${formatTemp(data.heatpump.targetTempC)}` : null,
                    data.indoorTemp && data.indoorTemp.configured && data.indoorTemp.tempC !== null ? withStaleness(`Ist: ${formatTemp(data.indoorTemp.tempC)}`, data.indoorTemp.updatedAt, OTHER_STALE_MINUTES) : null,
                    data.heatpump.dhwTankTempC !== null ? `WW-Speicher: ${formatTemp(data.heatpump.dhwTankTempC)}` : null,
                    (data.heatpump.heatingOn !== null || data.heatpump.supplyTempC !== null)
                        ? `Heizung: ${data.heatpump.heatingOn ? 'An' : 'Aus'}` + (data.heatpump.supplyTempC !== null ? ` (${formatTemp(data.heatpump.supplyTempC)})` : '')
                        : null,
                ].filter(Boolean)});
            } else if (type === 'car') {
                const iconHalfH = 38;
                const drop = buildFlowLineFromPath(`M ${colX},${busY} V ${rowY - iconHalfH}`, flows.carFlowKw);
                if (drop) svg.appendChild(drop);
                const isAway = data.car.state === 'away';
                const carImg = isAway ? {href: 'assets/ev-away.jpg', w: 356, h: 239} : {href: 'assets/ev-connected.jpg', w: 464, h: 229};
                svg.appendChild(buildFlowImage(carImg.href, colX, rowY, carImg.w, carImg.h, 100));
                const carLines = [];
                if (data.car.soc !== null) carLines.push(withStaleness(`Auto: Ladestand ${Math.round(data.car.soc)} %` + (data.car.rangeKm !== null ? ` (${data.car.rangeKm} km)` : ''), data.car.updatedAt, OTHER_STALE_MINUTES));
                else carLines.push('Auto');
                if (data.car.state === 'away') carLines.push('abwesend');
                else if (data.car.state === 'charging') carLines.push('lädt');
                else if (data.car.state === 'connected') carLines.push('eingesteckt');
                deviceDetailBlocks.push({colX, lines: carLines});
            } else if (type === 'sonstiger') {
                const iconHalfH = 34;
                const plugScale = 1.9;
                const drop = buildFlowLineFromPath(`M ${colX},${busY} V ${rowY - iconHalfH}`, flows.sonstigerFlowKw);
                if (drop) svg.appendChild(drop);
                svg.appendChild(buildPlugIcon(colX, rowY, flows.sonstigerOn, plugScale));
                deviceDetailBlocks.push({colX, lines: [`Sonstiges Gerät: ${flows.sonstigerOn ? 'An' : 'Aus'}`]});
            } else if (type === 'household') {
                const iconHalfH = 16;
                const drop = buildFlowLineFromPath(`M ${colX},${busY} V ${rowY - iconHalfH}`, flows.householdFlowKw);
                if (drop) svg.appendChild(drop);
                svg.appendChild(buildLightningIcon(colX, rowY));
                deviceDetailBlocks.push({colX, lines: ['Haushaltsstrom']});
            }
        });

        // Jeder Block bleibt horizontal unter SEINEM EIGENEN Icon (colX) zentriert, statt alle am
        // selben linken Rand zu starten - sonst wirkt es z.B. so, als gehoerten die Wallbox-Werte zur
        // Waermepumpe, weil beide am selben x anfangen. Vertikal starten jetzt ALLE Bloecke an
        // derselben Hoehe (nicht mehr nacheinander gestapelt) - sonst rutscht z.B. der Auto-Block
        // immer weiter nach unten, nur weil die (laengere) Waermepumpen-Liste davor mehr Zeilen
        // brauchte. Kollisionsgefahr besteht trotzdem nicht: die Bloecke stehen ja bereits an
        // unterschiedlichem x (siehe oben).
        const detailBlocksTopY = rowY + 60;
        for (const {colX, lines} of deviceDetailBlocks) {
            const placed = placeLabelBelow(colX, detailBlocksTopY, lines, {anchor: 'middle', lineHeight: MOBILE_FLOW_LABEL_LINE_HEIGHT});
            svg.appendChild(placed.el);
            contentBottomY = Math.max(contentBottomY, placed.bottomY + 16);
        }
    }

    // Hoehe (anders als beim Desktop-Layout mit fester VIEW_H) dynamisch anhand des tatsaechlich
    // gezeichneten Inhalts - die Verbraucher-Labels unten sind unterschiedlich lang (bis zu 5 Zeilen
    // bei der Waermepumpe), eine feste Hoehe wuerde entweder abschneiden oder unnoetig viel Leerraum
    // lassen.
    svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${contentBottomY}`);
    return svg;
}

// Baut BEIDE Layouts (Desktop + Mobil) und lässt CSS per @media-Breakpoint (siehe
// .energyFlowSvgDesktop/.energyFlowSvgMobile in index.html, dieselbe 600px-Grenze wie die
// vergroesserte .energyFlowLabel-Mobil-Schrift) entscheiden, welches sichtbar ist - robuster als ein
// JS-seitiger resize-Listener (funktioniert auch bei Rotation/Fenstergroessenaenderung ohne
// Nachbau-Aufruf) und aendert an refreshEnergyFlowWidget (ersetzt einfach den ganzen
// .energyFlowWidget-Knoten) nichts.
function buildEnergyFlowWidget(data) {
    const wrapper = document.createElement('div');
    wrapper.className = 'energyFlowWidget dashboardChart';
    const desktopSvg = buildEnergyFlowSvgDesktop(data);
    desktopSvg.classList.add('energyFlowSvgDesktop');
    wrapper.appendChild(desktopSvg);
    const mobileSvg = buildEnergyFlowSvgMobile(data);
    mobileSvg.classList.add('energyFlowSvgMobile');
    wrapper.appendChild(mobileSvg);
    return wrapper;
}

// WMO-Wettercode -> Emoji (grobe Gruppen). Siehe open-meteo-Doku / pv_forecast.py.
function weatherCodeemoji(code) {
    if (code === null || code === undefined) return '';
    if (code === 0) return '☀️';                 // klar
    if (code === 1 || code === 2) return '🌤️'; // leicht bewölkt
    if (code === 3) return '☁️';                 // bedeckt
    if (code === 45 || code === 48) return '🌫️'; // Nebel
    if (code >= 51 && code <= 57) return '🌦️';   // Niesel
    if (code >= 61 && code <= 67) return '🌧️';   // Regen
    if (code >= 71 && code <= 77) return '🌨️';   // Schnee
    if (code >= 80 && code <= 82) return '🌦️';   // Regenschauer
    if (code === 85 || code === 86) return '🌨️'; // Schneeschauer
    if (code >= 95) return '⛈️';                 // Gewitter
    return '';
}

// Aktueller Wettercode (WMO) fuer "jetzt" - gesetzt in loadDashboard aus /dashboard/weather,
// gelesen von renderSkyIcon (Himmels-Icon ueber dem Haus im Energiefluss-Widget). null = unbekannt.
let currentWeatherCode = null;

function weatherCodeForNow(weather) {
    const datetimes = (weather && weather.datetimes) || [];
    const codes = (weather && weather.weatherCode) || [];
    const nowMs = Date.now();
    let best = null;
    for (let i = 0; i < datetimes.length; i++) {
        // Stunden-Bucket [datetimes[i], datetimes[i] + 1h): der, in den "jetzt" faellt
        if (datetimes[i] <= nowMs && nowMs < datetimes[i] + 3600 * 1000) {
            best = codes[i];
            break;
        }
    }
    return (best === undefined) ? null : best;
}

// Kompakter, horizontal scrollbarer Wetter-Streifen ueber dem PV-Chart (nur Addon-Anzeige,
// speist sich aus /dashboard/weather bzw. pv_forecast.py). Zeigt ab "jetzt" die naechsten Stunden.
function buildWeatherStrip(weather) {
    const datetimes = weather.datetimes || [];
    const codes = weather.weatherCode || [];
    const temps = weather.temperature || [];
    if (!datetimes.length || codes.every(c => c === null || c === undefined)) return null;
    const nowMs = Date.now();
    const wrap = document.createElement('div');
    wrap.className = 'weatherStrip';
    let shown = 0;
    for (let i = 0; i < datetimes.length && shown < 24; i++) {
        if (datetimes[i] < nowMs - 3600 * 1000) continue; // vergangene Stunden ueberspringen
        const cell = document.createElement('div');
        cell.className = 'weatherCell';
        const d = new Date(datetimes[i]);
        const hh = document.createElement('div');
        hh.className = 'weatherCellHour';
        hh.textContent = d.getHours() + ' Uhr';
        const ic = document.createElement('div');
        ic.className = 'weatherCellIcon';
        ic.textContent = weatherCodeemoji(codes[i]);
        const tp = document.createElement('div');
        tp.className = 'weatherCellTemp';
        tp.textContent = (temps[i] === null || temps[i] === undefined) ? '' : Math.round(temps[i]) + '°';
        cell.appendChild(hh);
        cell.appendChild(ic);
        cell.appendChild(tp);
        wrap.appendChild(cell);
        shown++;
    }
    return shown ? wrap : null;
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
        // Wetter zuerst holen: der aktuelle Wettercode fliesst ins Himmels-Icon des Energiefluss-
        // Widgets (renderSkyIcon) und wird weiter unten fuer den Wetter-Streifen wiederverwendet.
        let weather = null;
        try {
            const weatherResponse = await getJson(insideHomeAssistant + '/dashboard/weather');
            if (weatherResponse.status === 'success') {
                weather = weatherResponse;
                currentWeatherCode = weatherCodeForNow(weather);
            }
        } catch (err) {
            console.log(err);
        }
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
        // Ersetzt die reine Prognose-Ansicht: gemeinsame Stundenachse ab 0 Uhr heute, Prognose
        // (heute eingefroren + ab morgen live) gegen tatsaechliche Ist-Werte (siehe
        // readPvForecastVsActual) - best-effort, faellt auf den einfachen Prognose-Chart zurueck,
        // falls der neue Endpunkt (noch) nichts liefert (z.B. frische Installation ohne Snapshot).
        if (weather) {
            const strip = buildWeatherStrip(weather);
            if (strip) container.appendChild(strip);
        }
        let pvChartRendered = false;
        try {
            const pvComparison = await getJson(insideHomeAssistant + '/dashboard/pv-forecast-vs-actual');
            if (pvComparison.status === 'success' && pvComparison.labels.length > 0) {
                container.appendChild(buildPvForecastActualChart(pvComparison.labels, pvComparison.forecast, pvComparison.actual));
                pvChartRendered = true;
            }
        } catch (err) {
            console.log(err);
        }
        if (!pvChartRendered) {
            container.appendChild(buildLineChart('PV-Leistung', 'kW', data.labels, data.pv_generation, {minY: 0}));
        }
        if (data.einsatzplan) {
            container.appendChild(buildEinsatzplanCard(data.einsatzplan, data.optimizer_running));
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

// Haelt das Energiefluss-Widget aktuell, ohne den restlichen Dashboard-Tab (Liniencharts,
// Anwesenheitsprognose) mit neu aufzubauen - die Charts aendern sich ohnehin nur stuendlich, taeglich
// neu zu laden waere unnoetiger Aufwand und wuerde bei jedem Tick kurz aufblitzen/den Scroll
// zuruecksetzen. Ersetzt nur den bestehenden .energyFlowWidget-Knoten durch einen frisch gebauten.
const ENERGY_FLOW_REFRESH_INTERVAL_MS = 30000;

async function refreshEnergyFlowWidget() {
    if (document.visibilityState !== 'visible') return;
    const dashboardTab = document.getElementById('tab-dashboard');
    if (!dashboardTab || !dashboardTab.classList.contains('active')) return;
    const container = document.getElementById('dashboardBody');
    const existing = container ? container.querySelector('.energyFlowWidget') : null;
    // kein bestehendes Widget (z.B. Dashboard noch nicht/fehlgeschlagen geladen) - nichts zu ersetzen,
    // der naechste volle loadDashboard() (Seitenaufruf) kuemmert sich darum
    if (!existing) return;
    try {
        const flowData = await getJson(insideHomeAssistant + '/dashboard/energy-flow');
        existing.replaceWith(buildEnergyFlowWidget(flowData));
    } catch (err) {
        // best-effort: das zuletzt erfolgreich gerenderte Widget bleibt einfach stehen
        console.log(err);
    }
}

setInterval(refreshEnergyFlowWidget, ENERGY_FLOW_REFRESH_INTERVAL_MS);

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

// Statuskarte oben auf der Konfigurationsseite regelmaessig auffrischen (wie das Dashboard seine
// Live-Werte), damit ein zwischenzeitlich behobenes/neu aufgetretenes Problem sichtbar wird, ohne
// dass der Nutzer die Seite neu laden muss.
const SYSTEM_HEALTH_REFRESH_INTERVAL_MS = 30000;
setInterval(() => {
    if (document.visibilityState === 'visible') {
        renderSystemHealth();
    }
}, SYSTEM_HEALTH_REFRESH_INTERVAL_MS);
