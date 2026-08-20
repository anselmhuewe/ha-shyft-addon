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
        description: ' Home-Assistant-Automation, die ausgelöst wird, wenn Shyft das Laden der Batterie aus PV-Überschuss zeitlich verschieben möchte.'
    },
    'battery_discharge_shift': {
        label: 'Batterie-Entladen verschieben',
        description: ' Home-Assistant-Automation, die ausgelöst wird, wenn Shyft das Entladen der Batterie zeitlich verschieben möchte.'
    },
    'battery_grid_charge': {
        label: 'Batterie netzladen',
        description: ' Home-Assistant-Automation, die ausgelöst wird, wenn Shyft die Batterie aus dem Netz laden möchte.'
    },
    'battery_action_stop': {
        label: 'Batterie-Aktion beenden',
        description: ' Home-Assistant-Automation, die ausgelöst wird, wenn Shyft eine laufende Batterie-Aktion beenden möchte.'
    },
    'hot_water': {
        label: 'Warmwasser',
        description: ' Home-Assistant-Automation, die ausgelöst wird, wenn Shyft die Warmwasserbereitung ansteuern möchte.'
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
    {key: 'pv_feed_in_limit', type: 'number', sensorField: 'photovoltaic_feed_in_limit_entity', actionKeys: ['pv_feed_in_limit'], titleLabel: 'PV: Einspeisung begrenzen (aktuell)', unit: '', step: 1},
    {key: 'consumption_limit_14a', type: 'number', sensorField: 'photovoltaic_consumption_limit_entity', actionKeys: ['consumption_limit_14a'], titleLabel: 'Verbrauch begrenzen §14a (aktuell)', unit: '', step: 1},
    {key: 'consumer_on_off', type: 'switch', sensorField: 'sonstiger_verbraucher_switch_entity', actionKeys: ['consumer_on', 'consumer_off'], titleLabel: 'Sonstiger Verbraucher (aktuell)'},
];
const AUTO_MANAGED_ACTION_KEYS = new Set(AUTO_MANAGED_CONTROLS.flatMap(c => c.actionKeys));

// "Auto laden" gets its own bespoke recipe UI (buildCarChargeControl) instead of the uniform
// AUTO_MANAGED_CONTROLS shape, since it's a multi-stage, manufacturer-varying command sequence.
const CAR_CHARGE_ACTION_KEYS = new Set(['car_charge_start', 'car_charge_stop']);

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

let currentIntegrationSelections = {};

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
    for (const control of AUTO_MANAGED_CONTROLS) {
        const toggleKey = control.actionKeys[0];
        const toggleElement = document.getElementById(toggleKey + ACTION_TOGGLE_POSTFIX);
        if (toggleElement) {
            actionTypeEnabled[toggleKey] = toggleElement.checked;
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
    for (const stageKey of ['phaseCount', 'start', 'stop']) {
        const serviceElement = document.getElementById('car_charge_' + stageKey + '_service');
        if (!serviceElement) continue;
        const stage = {...(carChargeRecipe[stageKey] || {})};
        stage.service = serviceElement.value;
        const targetElement = document.getElementById('car_charge_' + stageKey + '_target');
        // extracted client-side: the backend's generic display-format stripping only reaches one
        // level of nesting, and carChargeRecipe's stages are nested two levels deep
        if (targetElement) stage.targetEntity = extractEntityId(targetElement.value);
        const dataElement = document.getElementById('car_charge_' + stageKey + '_data');
        if (dataElement) stage.data = dataElement.value;
        carChargeRecipe[stageKey] = stage;
    }

    const toBeWritten = {
        "sensorMappings": sensorValues,
        "actorMappings": actorValues,
        "integrationMappings": integrationValues,
        "actionTypeEnabled": actionTypeEnabled,
        "carChargeRecipe": carChargeRecipe,
        "notificationTargets": notificationTargets,
        "notificationsEnabled": notificationsEnabled
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

async function autoSave() {
    const statusElement = document.getElementById('saveStatus');
    try {
        if (statusElement) {
            statusElement.classList.remove('status-saved', 'status-error');
            statusElement.textContent = 'Speichere...';
        }
        await saveConfigurationNow();
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

function renderIntegrationSections() {
    const container = document.getElementById('deviceSections');
    container.innerHTML = '';
    const integrationMappings = configData["integrationMappings"] || {};

    for (const section of INTEGRATION_SECTIONS) {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'integrationSection';

        const heading = document.createElement('div');
        heading.className = 'integrationHeading';
        const headingRow = document.createElement('div');
        headingRow.className = 'integrationHeadingRow';
        const headingTitle = document.createElement('h2');
        headingTitle.textContent = section.label;
        headingRow.appendChild(headingTitle);
        if (section.description) {
            headingRow.appendChild(buildTooltip(section.description));
        }
        heading.appendChild(headingRow);

        const currentIds = integrationMappings[section.key] || [];
        currentIntegrationSelections[section.key] = currentIds;

        const bodyDiv = document.createElement('div');
        bodyDiv.id = 'section_body_' + section.key;
        bodyDiv.style.display = currentIds.length > 0 ? '' : 'none';
        if (currentIds.length > 0) {
            renderSectionBody(bodyDiv, section, currentIds);
        }

        const picker = buildIntegrationPicker(section, currentIds, (selectedIds) => {
            currentIntegrationSelections[section.key] = selectedIds;
            bodyDiv.style.display = selectedIds.length > 0 ? '' : 'none';
            if (selectedIds.length > 0) {
                renderSectionBody(bodyDiv, section, selectedIds);
            } else {
                bodyDiv.innerHTML = '';
            }
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
    }

    const manualActions = section.actions.filter(key => !AUTO_MANAGED_ACTION_KEYS.has(key) && !CAR_CHARGE_ACTION_KEYS.has(key));
    const sectionControls = AUTO_MANAGED_CONTROLS.filter(c => c.actionKeys.some(k => section.actions.includes(k)));
    const hasCarCharge = section.actions.some(k => CAR_CHARGE_ACTION_KEYS.has(k));

    if (manualActions.length > 0 || sectionControls.length > 0 || hasCarCharge) {
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
        bodyDiv.appendChild(buildCarChargeControl(candidateEntities));
    }
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

function buildAutoManagedNumberControl(control) {
    const wrapper = document.createElement('div');
    wrapper.className = 'autoActionControl';

    const {title, checkmark} = buildAutoActionTitle(control, control.actionKeys[0]);
    wrapper.appendChild(title);

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
                status.textContent = 'Befülle die "' + control.titleLabel + '"';
                status.className = 'autoActionStatus status-missing';
                checkmark.hidden = true;
                minusButton.disabled = true;
                plusButton.disabled = true;
                valueDisplay.textContent = 'Aktueller Wert: –';
                return;
            }
            minusButton.disabled = false;
            plusButton.disabled = false;
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
                // devices reachable only via a manufacturer cloud API can take a while to
                // report the new value back, so show what we sent right away, then confirm
                valueDisplay.textContent = 'Gesendet: ' + result.value + unitSuffix + ' (prüfe...)';
                setTimeout(refreshStatus, 4000);
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

    wrapper.__refresh = refreshStatus;
    refreshStatus();

    return wrapper;
}

function buildAutoManagedSwitchControl(control) {
    const wrapper = document.createElement('div');
    wrapper.className = 'autoActionControl';

    const {title, checkmark} = buildAutoActionTitle(control, control.actionKeys[0]);
    wrapper.appendChild(title);

    const status = document.createElement('div');
    status.className = 'autoActionStatus';
    status.textContent = 'Lade Status...';
    wrapper.appendChild(status);

    const controlsRow = document.createElement('div');
    controlsRow.className = 'autoActionButtons';

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'autoActionValue';
    valueDisplay.textContent = 'Aktueller Status: –';

    const testToggleLabel = buildBareToggleSwitch(false);
    const testToggleInput = testToggleLabel.querySelector('input');

    async function refreshStatus() {
        try {
            const result = await getJson(insideHomeAssistant + '/actions/' + control.key + '/status');
            if (!result.configured) {
                status.textContent = 'Befülle die "' + control.titleLabel + '"';
                status.className = 'autoActionStatus status-missing';
                checkmark.hidden = true;
                testToggleInput.disabled = true;
                valueDisplay.textContent = 'Aktueller Status: –';
                return;
            }
            testToggleInput.disabled = false;
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
                testToggleInput.checked = isOn;
            }
        } catch (err) {
            console.log(err);
            status.textContent = 'Status konnte nicht geladen werden.';
            status.className = 'autoActionStatus status-error';
            checkmark.hidden = true;
            valueDisplay.textContent = 'Aktueller Status: –';
        }
    }

    testToggleInput.addEventListener('change', async () => {
        const turnOn = testToggleInput.checked;
        testToggleInput.disabled = true;
        valueDisplay.textContent = 'Teste...';
        try {
            const response = await fetch(insideHomeAssistant + '/actions/' + control.key + '/test', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({on: turnOn})
            });
            const result = await response.json();
            if (result.success) {
                valueDisplay.textContent = 'Gesendet: ' + (turnOn ? 'An' : 'Aus') + ' (prüfe...)';
                setTimeout(refreshStatus, 4000);
            } else {
                valueDisplay.textContent = 'Fehler: ' + (result.message || 'unbekannt');
            }
        } catch (err) {
            console.log(err);
            valueDisplay.textContent = 'Fehler beim Testen';
        } finally {
            testToggleInput.disabled = false;
        }
    });

    controlsRow.appendChild(valueDisplay);
    controlsRow.appendChild(testToggleLabel);
    wrapper.appendChild(controlsRow);

    wrapper.__refresh = refreshStatus;
    refreshStatus();

    return wrapper;
}

// "Auto laden" doesn't fit the uniform AUTO_MANAGED_CONTROLS shape: it's a manufacturer-varying
// command sequence (currently one recipe, "Zweistufig": set phase count, then start charging) plus
// an independent single-action "Laden beenden". Kept separate from AUTO_MANAGED_CONTROLS since the
// concrete kW->Phasen/Ampere math lives entirely server-side (see compute_charging_phases_and_amps).
// Domains eligible as an "Auto laden" Befehl: generic controllable-entity domains, plus whatever
// domain(s) the currently selected Wallbox-Integration(s) belong to (e.g. 'easee') - so
// integration-specific services like easee.set_charger_phase_mode show up as candidates too.
function getWallboxServiceDomains() {
    const domains = new Set(['number', 'select', 'button', 'switch']);
    const selectedIds = currentIntegrationSelections['wallbox'] || [];
    for (const integration of integrationsData.integrations) {
        if (selectedIds.includes(integration.id)) {
            const match = integration.name.match(/\(([^)]+)\)$/);
            if (match) domains.add(match[1]);
        }
    }
    return domains;
}

// One row set for a recipe stage: which Home Assistant service to call, an optional target entity
// (sent as entity_id), and free-form JSON data for whatever else the service needs. Everything
// about the service (which fields it takes, whether it needs a target at all) varies by
// manufacturer, so this stays generic rather than assuming a fixed shape.
function buildRecipeStageFields(stageKey, label, tooltip, candidateServices, entityDatalistId, stageData) {
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');

    const serviceDatalistId = 'carChargeServiceOptions_' + stageKey;
    const serviceDatalist = document.createElement('datalist');
    serviceDatalist.id = serviceDatalistId;
    for (const s of candidateServices) {
        const option = document.createElement('option');
        option.value = s.service;
        option.textContent = s.label;
        serviceDatalist.appendChild(option);
    }
    table.appendChild(serviceDatalist);

    const serviceRow = document.createElement('tr');
    const serviceLabelCell = document.createElement('td');
    serviceLabelCell.textContent = label;
    serviceLabelCell.appendChild(buildTooltip(tooltip));
    const serviceValueCell = document.createElement('td');
    const serviceInput = document.createElement('input');
    serviceInput.id = 'car_charge_' + stageKey + '_service';
    serviceInput.value = stageData.service || '';
    serviceInput.setAttribute('list', serviceDatalistId);
    serviceInput.setAttribute('class', 'sensorInput');
    serviceInput.setAttribute('autocomplete', 'off');
    serviceInput.placeholder = 'z.B. easee.set_charger_phase_mode';
    serviceValueCell.appendChild(serviceInput);
    serviceRow.appendChild(serviceLabelCell);
    serviceRow.appendChild(serviceValueCell);
    tbody.appendChild(serviceRow);

    const targetRow = document.createElement('tr');
    const targetLabelCell = document.createElement('td');
    targetLabelCell.textContent = 'Ziel-Entity (optional)';
    targetLabelCell.appendChild(buildTooltip('Falls der Befehl eine Entity als Ziel braucht (z.B. number.set_value), wird sie hier als entity_id mitgeschickt. Manche Integrationen (z.B. Easee) erwarten stattdessen eine device_id als Datenfeld - dann hier leer lassen und die device_id unten eintragen.'));
    const targetValueCell = document.createElement('td');
    const targetInputWrapper = document.createElement('div');
    targetInputWrapper.className = 'clearableInput';
    const targetInput = document.createElement('input');
    targetInput.id = 'car_charge_' + stageKey + '_target';
    targetInput.value = formatEntityDisplay(stageData.targetEntity || '');
    targetInput.setAttribute('list', entityDatalistId);
    targetInput.setAttribute('class', 'sensorInput');
    targetInput.setAttribute('autocomplete', 'off');
    targetInput.addEventListener('change', () => {
        targetInput.value = formatEntityDisplay(extractEntityId(targetInput.value));
        autoSave();
    });
    targetInputWrapper.appendChild(targetInput);
    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'clearInputButton';
    clearButton.textContent = '×';
    clearButton.setAttribute('aria-label', 'Eingabe löschen');
    clearButton.addEventListener('click', () => {
        targetInput.value = '';
        targetInput.dispatchEvent(new Event('change'));
        targetInput.focus();
    });
    targetInputWrapper.appendChild(clearButton);
    targetValueCell.appendChild(targetInputWrapper);
    targetRow.appendChild(targetLabelCell);
    targetRow.appendChild(targetValueCell);
    tbody.appendChild(targetRow);

    const dataRow = document.createElement('tr');
    const dataLabelCell = document.createElement('td');
    dataLabelCell.textContent = 'Datenfelder (JSON)';
    dataLabelCell.appendChild(buildTooltip('Zusätzliche Parameter für den Befehl als JSON, z.B. {"device_id": "...", "mode": "{value}"}. Schreibe "{value}" genau an die Stelle, an der die berechnete Phasen- bzw. Amperezahl eingesetzt werden soll.'));
    const dataValueCell = document.createElement('td');
    const dataTextarea = document.createElement('textarea');
    dataTextarea.id = 'car_charge_' + stageKey + '_data';
    dataTextarea.className = 'sensorInput';
    dataTextarea.rows = 2;
    dataTextarea.value = stageData.data || '';
    dataTextarea.placeholder = '{}';
    dataTextarea.addEventListener('change', autoSave);
    dataValueCell.appendChild(dataTextarea);
    const fieldHint = document.createElement('div');
    fieldHint.className = 'serviceFieldHint';
    dataValueCell.appendChild(fieldHint);
    dataRow.appendChild(dataLabelCell);
    dataRow.appendChild(dataValueCell);
    tbody.appendChild(dataRow);

    function updateFieldHint() {
        const match = allServiceOptions.find(s => s.service === serviceInput.value);
        if (match && match.fields.length > 0) {
            fieldHint.textContent = 'Felder dieses Befehls: ' + match.fields.join(', ');
        } else if (match) {
            fieldHint.textContent = 'Dieser Befehl braucht keine zusätzlichen Datenfelder.';
        } else {
            fieldHint.textContent = '';
        }
    }
    serviceInput.addEventListener('change', () => {
        updateFieldHint();
        autoSave();
    });
    updateFieldHint();

    table.appendChild(tbody);
    return table;
}

function buildCarChargeControl(candidateEntities) {
    const wrapper = document.createElement('div');
    wrapper.className = 'autoActionControl';

    const {title, checkmark} = buildAutoActionTitle({titleLabel: 'Auto laden'}, 'car_charge_start');
    wrapper.appendChild(title);

    const recipe = configData['carChargeRecipe'] || {};
    const phaseCountStage = recipe.phaseCount || {};
    const startStage = recipe.start || {};
    const stopStage = recipe.stop || {};
    checkmark.hidden = !(recipe.type === 'two_stage' && phaseCountStage.service && startStage.service && stopStage.service);

    const controlDomains = ['number', 'select', 'button', 'switch'];
    const entityDatalistId = 'carChargeEntityOptions';
    const entityDatalist = document.createElement('datalist');
    entityDatalist.id = entityDatalistId;
    for (const entity of candidateEntities) {
        if (entityMatchesSensorFilter(entity, {type: 'domain', values: controlDomains})) {
            const option = document.createElement('option');
            option.value = entity.label;
            entityDatalist.appendChild(option);
        }
    }
    wrapper.appendChild(entityDatalist);

    const candidateServices = allServiceOptions.filter(s => getWallboxServiceDomains().has(s.service.split('.')[0]));

    const variantsHeading = document.createElement('div');
    variantsHeading.className = 'sectionSubHeading';
    variantsHeading.textContent = 'Auto laden';
    wrapper.appendChild(variantsHeading);

    const recipeTable = document.createElement('table');
    const recipeTbody = document.createElement('tbody');
    const recipeRow = document.createElement('tr');
    const recipeLabelCell = document.createElement('td');
    recipeLabelCell.textContent = 'Varianten';
    recipeLabelCell.appendChild(buildTooltip('Wie das Addon deine Wallbox ansteuert, um einen Ladevorgang zu starten. "Zweistufig" setzt zuerst die Phasenzahl, dann startet es den Ladevorgang.'));
    const recipeValueCell = document.createElement('td');
    const recipeSelect = document.createElement('select');
    recipeSelect.id = 'car_charge_recipe_type';
    recipeSelect.className = 'sensorInput';
    const noRecipeOption = document.createElement('option');
    noRecipeOption.value = '';
    noRecipeOption.textContent = '– keine Variante ausgewählt –';
    recipeSelect.appendChild(noRecipeOption);
    const twoStageOption = document.createElement('option');
    twoStageOption.value = 'two_stage';
    twoStageOption.textContent = 'Zweistufig';
    recipeSelect.appendChild(twoStageOption);
    recipeSelect.value = recipe.type || '';
    recipeValueCell.appendChild(recipeSelect);
    recipeRow.appendChild(recipeLabelCell);
    recipeRow.appendChild(recipeValueCell);
    recipeTbody.appendChild(recipeRow);
    recipeTable.appendChild(recipeTbody);
    wrapper.appendChild(recipeTable);

    const stagesWrapper = document.createElement('div');
    stagesWrapper.appendChild(buildRecipeStageFields('phaseCount', 'Phasenzahl setzen',
        'Befehl, mit dem die Phasenzahl an deiner Wallbox eingestellt wird.',
        candidateServices, entityDatalistId, phaseCountStage));
    stagesWrapper.appendChild(buildRecipeStageFields('start', 'Ladevorgang starten',
        'Befehl, mit dem der Ladevorgang gestartet wird.',
        candidateServices, entityDatalistId, startStage));
    stagesWrapper.style.display = recipeSelect.value === 'two_stage' ? '' : 'none';
    wrapper.appendChild(stagesWrapper);

    recipeSelect.addEventListener('change', () => {
        stagesWrapper.style.display = recipeSelect.value === 'two_stage' ? '' : 'none';
        autoSave();
    });

    const status = document.createElement('div');
    status.className = 'autoActionStatus';
    wrapper.appendChild(status);

    const controlsRow = document.createElement('div');
    controlsRow.className = 'autoActionButtons';

    const wallboxStatusDisplay = document.createElement('span');
    wallboxStatusDisplay.className = 'autoActionValue';

    const phaseTestInput = document.createElement('input');
    phaseTestInput.type = 'number';
    phaseTestInput.value = '1';
    phaseTestInput.min = '1';
    phaseTestInput.max = '3';
    phaseTestInput.title = 'Test-Phasenzahl';
    phaseTestInput.className = 'testPhaseInput';

    const testStartButton = document.createElement('button');
    testStartButton.type = 'button';
    testStartButton.textContent = 'Test: Laden starten';

    function refreshWallboxStatus() {
        const wallboxEntity = (configData['sensorMappings'] || {})['wallbox_plugged'] || '';
        if (!wallboxEntity) {
            wallboxStatusDisplay.textContent = 'Wallbox-Status: – (kein Sensor zugeordnet)';
            return;
        }
        const match = allSensorIdOptions.find(e => e.entity_id === wallboxEntity);
        wallboxStatusDisplay.textContent = 'Wallbox-Status: ' + (match ? match.state : '–');
    }

    testStartButton.addEventListener('click', async () => {
        testStartButton.disabled = true;
        status.textContent = 'Teste...';
        status.className = 'autoActionStatus';
        try {
            const response = await fetch(insideHomeAssistant + '/actions/car_charge_start/test', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({phaseCount: parseInt(phaseTestInput.value, 10) || 1})
            });
            const result = await response.json();
            if (result.success) {
                status.textContent = `Gesendet: ${result.phaseCount} Phase(n), ${result.amps} A (prüfe Wallbox-Status...)`;
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
            testStartButton.disabled = false;
        }
    });

    controlsRow.appendChild(wallboxStatusDisplay);
    controlsRow.appendChild(phaseTestInput);
    controlsRow.appendChild(testStartButton);
    wrapper.appendChild(controlsRow);

    const stopHeading = document.createElement('div');
    stopHeading.className = 'sectionSubHeading';
    stopHeading.textContent = 'Laden beenden';
    wrapper.appendChild(stopHeading);

    const stopWrapper = document.createElement('div');
    stopWrapper.appendChild(buildRecipeStageFields('stop', 'Auto laden beenden',
        'Befehl, mit dem der Ladevorgang beendet wird - unabhängig von der gewählten Start-Variante, da das herstellerübergreifend meist eine einzelne Aktion ist.',
        candidateServices, entityDatalistId, stopStage));
    wrapper.appendChild(stopWrapper);

    const stopControlsRow = document.createElement('div');
    stopControlsRow.className = 'autoActionButtons';
    const stopStatus = document.createElement('span');
    stopStatus.className = 'autoActionValue';
    const testStopButton = document.createElement('button');
    testStopButton.type = 'button';
    testStopButton.textContent = 'Test: Laden beenden';

    testStopButton.addEventListener('click', async () => {
        testStopButton.disabled = true;
        stopStatus.textContent = 'Teste...';
        try {
            const response = await fetch(insideHomeAssistant + '/actions/car_charge_stop/test', {method: 'POST'});
            const result = await response.json();
            if (result.success) {
                stopStatus.textContent = 'Gesendet (prüfe Wallbox-Status...)';
                setTimeout(refreshWallboxStatus, 4000);
            } else {
                stopStatus.textContent = 'Fehler: ' + (result.message || 'unbekannt');
            }
        } catch (err) {
            console.log(err);
            stopStatus.textContent = 'Fehler beim Testen';
        } finally {
            testStopButton.disabled = false;
        }
    });

    stopControlsRow.appendChild(stopStatus);
    stopControlsRow.appendChild(testStopButton);
    wrapper.appendChild(stopControlsRow);

    wrapper.__refresh = refreshWallboxStatus;
    refreshWallboxStatus();

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

if (document.readyState === 'complete') {
    loadConfiguration();
    loadShyftActions();
    setupTabs();
} else {
    window.addEventListener('load', () => {
        loadConfiguration();
        loadShyftActions();
        setupTabs();
    });
}

setInterval(refreshLiveSensorValues, LIVE_VALUE_REFRESH_INTERVAL_MS);
