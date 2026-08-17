const outsideHomeAssistant = "http://localhost:8000/0";
const insideHomeAssistant = window.location.pathname;
const configUri = insideHomeAssistant + "/config";
const sensorIdsUri = insideHomeAssistant + "/sensorids";
const integrationsUri = insideHomeAssistant + "/integrations";
let configData = {}
let integrationsData = {integrations: [], entityMap: {}};
let allSensorIdOptions = [];

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
        label: 'Zieltemperatur (aktuell)',
        description: ' Gewünschte Raumtemperatur in °C, die du an deiner Wärmepumpe einstellst. Über die stündliche Anpassung dieses Werte steuert Shyft die Leistung deiner Wärmepumpe.'
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
    'electronicvehicle_plugged': {
        label: 'Auto verbunden?',
        description: 'Ja / Nein, je nachdem ob dein Auto eine Verbindung mit der Wallbox meldet oder nicht.'
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
        label: 'Heizung Soll-Temperatur',
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

const INTEGRATION_SECTIONS = [
    {
        key: 'wechselrichter',
        label: 'Wechselrichter',
        sensors: ['photovoltaic_powerflow_pv', 'photovoltaic_powerflow_load', 'photovoltaic_powerflow_grid', 'photovoltaic_powerflow_battery'],
        actions: ['pv_feed_in_limit', 'consumption_limit_14a'],
        requiresPowerSensor: true
    },
    {
        key: 'batterie',
        label: 'Batterie',
        sensors: ['battery_storage_command_mode', 'battery_state_of_charge', 'battery_charge_limit_current', 'battery_discharge_limit_current'],
        actions: ['battery_charge_shift_pv_surplus', 'battery_discharge_shift', 'battery_grid_charge', 'battery_action_stop'],
        requiresPowerSensor: true
    },
    {
        key: 'waermepumpe',
        label: 'Wärmepumpe',
        sensors: ['heatpump_dhw_tank_temp', 'heatpump_dhw_activated', 'heatpump_dhw_on_off', 'heatpump_heating_target_temp_normal', 'heatpump_heating_activated', 'heatpump_current_power_elect', 'heatpump_on_off', 'heatpump_supply_temp_hp'],
        actions: ['hot_water', 'heating_target_temp']
    },
    {
        key: 'auto',
        label: 'Auto',
        sensors: ['electronicvehicle_state_of_charge', 'electronicvehicle_plugged'],
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
        actions: []
    },
    {
        key: 'sonstiger_verbraucher',
        label: 'Sonstiger Verbraucher',
        sensors: [],
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

async function saveConfigurationNow() {
    const sensorValues = {...(configData["sensorMappings"] || {})};
    const actorValues = {...(configData["actorMappings"] || {})};
    const integrationValues = {};

    for (const section of INTEGRATION_SECTIONS) {
        const integrationInput = document.getElementById(integrationInputId(section));
        integrationValues[section.key] = integrationInput ? extractEntryId(integrationInput.value) : '';

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
        }
    }

    const toBeWritten = {"sensorMappings": sensorValues, "actorMappings": actorValues, "integrationMappings": integrationValues};
    await putJson(configUri, toBeWritten);
    configData = toBeWritten;
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

        const allEntityOptionsElement = document.getElementById('allEntityOptions');
        for (const optionText of allSensorIdOptions) {
            const option = document.createElement("option");
            option.value = optionText;
            allEntityOptionsElement.appendChild(option);
        }

        renderIntegrationSections();
    } catch (err) {
        console.log(err);
    }
}

function integrationInputId(section) {
    return 'integration_input_' + section.key;
}

function extractEntryId(value) {
    return (value || '').split(':')[0].trim();
}

function formatIntegrationValue(entryId) {
    if (!entryId) return '';
    const match = integrationsData.integrations.find(integration => integration.id === entryId);
    if (match) return entryId + ': ' + match.name;
    return entryId + ' (nicht mehr gefunden)';
}

function integrationHasPowerSensor(entryId) {
    const entityIds = integrationsData.entityMap[entryId] || [];
    return allSensorIdOptions.some(optionText => {
        const colonIndex = optionText.indexOf(':');
        if (colonIndex === -1) return false;
        const entityId = optionText.slice(0, colonIndex);
        if (!entityIds.includes(entityId)) return false;
        const unit = optionText.slice(colonIndex + 1).trim().split(' ').pop();
        return unit === 'W' || unit === 'kW';
    });
}

function renderIntegrationSections() {
    const container = document.getElementById('deviceSections');
    container.innerHTML = '';
    const integrationMappings = configData["integrationMappings"] || {};

    for (const section of INTEGRATION_SECTIONS) {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'integrationSection';

        const heading = document.createElement('div');
        heading.className = 'integrationHeading';
        const headingTitle = document.createElement('h2');
        headingTitle.textContent = section.label;
        heading.appendChild(headingTitle);

        const currentEntryId = integrationMappings[section.key] || '';
        const input = buildIntegrationInput(heading, section, currentEntryId);
        sectionDiv.appendChild(heading);

        const bodyDiv = document.createElement('div');
        bodyDiv.id = 'section_body_' + section.key;
        bodyDiv.style.display = currentEntryId ? '' : 'none';
        if (currentEntryId) {
            renderSectionBody(bodyDiv, section, currentEntryId);
        }
        sectionDiv.appendChild(bodyDiv);

        input.addEventListener('change', () => {
            const entryId = extractEntryId(input.value);
            bodyDiv.style.display = entryId ? '' : 'none';
            if (entryId) {
                renderSectionBody(bodyDiv, section, entryId);
            } else {
                bodyDiv.innerHTML = '';
            }
            autoSave();
        });

        container.appendChild(sectionDiv);
    }
}

function buildIntegrationInput(heading, section, currentEntryId) {
    const datalistId = 'integrationOptions_' + section.key;
    const datalist = document.createElement('datalist');
    datalist.id = datalistId;

    const options = integrationsData.integrations.filter(integration =>
        !section.requiresPowerSensor || integrationHasPowerSensor(integration.id)
    );
    for (const integration of options) {
        const option = document.createElement('option');
        option.value = integration.id + ': ' + integration.name;
        datalist.appendChild(option);
    }
    heading.appendChild(datalist);

    const input = document.createElement('input');
    input.id = integrationInputId(section);
    input.setAttribute('list', datalistId);
    input.setAttribute('class', 'sensorInput');
    input.setAttribute('placeholder', 'nicht vorhanden');
    input.value = formatIntegrationValue(currentEntryId);
    heading.appendChild(input);

    return input;
}

function renderSectionBody(bodyDiv, section, entryId) {
    bodyDiv.innerHTML = '';

    if (section.sensors.length > 0) {
        const entityDatalistId = 'entityOptions_' + section.key;
        const datalist = document.createElement('datalist');
        datalist.id = entityDatalistId;
        const integrationEntityIds = integrationsData.entityMap[entryId] || [];
        for (const optionText of allSensorIdOptions) {
            const entityId = optionText.split(':')[0];
            if (integrationEntityIds.includes(entityId)) {
                const option = document.createElement('option');
                option.value = optionText;
                datalist.appendChild(option);
            }
        }
        bodyDiv.appendChild(datalist);
        bodyDiv.appendChild(buildMappingTable('Shyft-Sensor', 'Home Assistant Entity ID', section.sensors, configData["sensorMappings"] || {}, helpinformation, VALUE_POSTFIX, entityDatalistId));
    }

    if (section.actions.length > 0) {
        bodyDiv.appendChild(buildMappingTable('Shyft-Aktion', 'Home Assistant Automation', section.actions, configData["actorMappings"] || {}, actorHelpInformation, ACTOR_VALUE_POSTFIX, 'allEntityOptions'));
    }
}

function buildMappingTable(headerLeft, headerRight, keys, mappingData, helpInfo, valuePostfix, datalistId) {
    const table = document.createElement('table');

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    const th1 = document.createElement('th');
    th1.className = 'tableHeaderCell';
    th1.textContent = headerLeft;
    const th2 = document.createElement('th');
    th2.className = 'tableHeaderCell';
    th2.textContent = headerRight;
    headRow.appendChild(th1);
    headRow.appendChild(th2);
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const key of keys) {
        tbody.appendChild(buildMappingRow(key, mappingData[key] || '', helpInfo, valuePostfix, datalistId));
    }
    table.appendChild(tbody);

    return table;
}

function buildMappingRow(key, value, helpInfo, valuePostfix, datalistId) {
    const row = document.createElement('tr');
    const keyCell = document.createElement('td');
    const context = helpInfo[key] ?? {label: key};
    keyCell.textContent = context.label;

    const tooltip = document.createElement("span");
    tooltip.className = 'tooltip';
    const tooltipIcon = document.createElement("span");
    tooltipIcon.className = 'tooltip-icon';
    tooltipIcon.textContent = '?';
    tooltip.appendChild(tooltipIcon);
    const tooltipText = document.createElement("span");
    tooltipText.className = 'tooltip-text';
    tooltipText.textContent = (helpInfo[key] ?? {description: key}).description;
    tooltip.appendChild(tooltipText);
    keyCell.appendChild(tooltip);

    const inputValue = document.createElement('input');
    inputValue.id = key + valuePostfix;
    inputValue.value = value;
    inputValue.setAttribute("list", datalistId);
    inputValue.setAttribute("class", "sensorInput");
    inputValue.addEventListener('change', autoSave);

    const valueCell = document.createElement('td');
    valueCell.appendChild(inputValue);

    row.appendChild(keyCell);
    row.appendChild(valueCell);
    return row;
}


if (document.readyState === 'complete') {
    loadConfiguration();
} else {
    window.addEventListener('load', loadConfiguration);
}
