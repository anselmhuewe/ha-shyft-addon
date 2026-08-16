const outsideHomeAssistant = "http://localhost:8000/0";
const insideHomeAssistant = window.location.pathname;
const configUri = insideHomeAssistant + "/config";
const sensorIdsUri = insideHomeAssistant + "/sensorids";
let configData = {}

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
    'car_charge': {
        label: 'Auto laden',
        description: ' Home-Assistant-Automation, die ausgelöst wird, wenn Shyft dein Auto laden möchte.'
    },
    'room_temperature_increase': {
        label: 'Raumtemperatur höher',
        description: ' Home-Assistant-Automation, die ausgelöst wird, wenn Shyft die Raumtemperatur erhöhen möchte.'
    },
    'hot_water_prepare': {
        label: 'Warmwasser bereiten',
        description: ' Home-Assistant-Automation, die ausgelöst wird, wenn Shyft die Warmwasserbereitung anstoßen möchte.'
    },
}

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

function saveConfiguration() {
    return async () => {
        console.log("saveConfiguration aufgerufen");
        const sensorValues = {};
        for (const [key] of Object.entries(configData["sensorMappings"])) {
            sensorValues[key] = document.getElementById(key + VALUE_POSTFIX).value;
        }
        const actorValues = {};
        for (const [key] of Object.entries(configData["actorMappings"])) {
            actorValues[key] = document.getElementById(key + ACTOR_VALUE_POSTFIX).value;
        }

        const toBeWritten = {"sensorMappings": sensorValues, "actorMappings": actorValues};
        await putJson(configUri, toBeWritten);
    }
}

const loadConfiguration = async (event) => {
    try {
        console.log("loadConfiguration called");
        configData = await getJson(configUri);
        const sensorIds = await getJson(sensorIdsUri);
        const sensorIdsGUIElement = document.getElementById('sensorIds');

        for (const sensorId of sensorIds) {
            const option = document.createElement("option");
            option.value = sensorId;
            sensorIdsGUIElement.appendChild(option);
        }
        renderSensorMappings(configData["sensorMappings"]);
        renderActorMappings(configData["actorMappings"]);
    } catch (err) {
    }
}

function renderSensorMappings(configData) {
    const tbody = document.getElementById('sensorMappingId');
    tbody.innerHTML = '';
    for (const [key, value] of Object.entries(configData)) {
        const row = document.createElement('tr');
        const keyCell = document.createElement('td');
        const context = helpinformation[key] ?? {'label': key};
        const label = context.label;
        keyCell.textContent = label;

        const tooltip = document.createElement("span");
        tooltip.className = 'tooltip';
        const tooltipIcon = document.createElement("span");
        tooltipIcon.className = 'tooltip-icon';
        tooltipIcon.textContent = '?';
        tooltip.appendChild(tooltipIcon);
        const tooltipText = document.createElement("span");
        tooltipText.className = 'tooltip-text';
        const tooltipFromConfig = helpinformation[key] ?? {'description': key};
        tooltipText.textContent = tooltipFromConfig.description;
        tooltip.appendChild(tooltipText);
        keyCell.appendChild(tooltip);

        const inputValue = document.createElement('input');
        inputValue.id = key + VALUE_POSTFIX;
        inputValue.value = value;
        inputValue.setAttribute("list", "sensorIds");
        inputValue.setAttribute("class", "sensorInput");

        const valueCell = document.createElement('td');
        valueCell.appendChild(inputValue);

        row.appendChild(keyCell);
        row.appendChild(valueCell);
        tbody.appendChild(row);
    }
}

function renderActorMappings(configData) {
    const tbody = document.getElementById('actorMappingId');
    tbody.innerHTML = '';
    for (const [key, value] of Object.entries(configData)) {
        const row = document.createElement('tr');
        const keyCell = document.createElement('td');
        const context = actorHelpInformation[key] ?? {'label': key};
        const label = context.label;
        keyCell.textContent = label;

        const tooltip = document.createElement("span");
        tooltip.className = 'tooltip';
        const tooltipIcon = document.createElement("span");
        tooltipIcon.className = 'tooltip-icon';
        tooltipIcon.textContent = '?';
        tooltip.appendChild(tooltipIcon);
        const tooltipText = document.createElement("span");
        tooltipText.className = 'tooltip-text';
        const tooltipFromConfig = actorHelpInformation[key] ?? {'description': key};
        tooltipText.textContent = tooltipFromConfig.description;
        tooltip.appendChild(tooltipText);
        keyCell.appendChild(tooltip);

        const inputValue = document.createElement('input');
        inputValue.id = key + ACTOR_VALUE_POSTFIX;
        inputValue.value = value;
        inputValue.setAttribute("list", "sensorIds");
        inputValue.setAttribute("class", "sensorInput");

        const valueCell = document.createElement('td');
        valueCell.appendChild(inputValue);

        row.appendChild(keyCell);
        row.appendChild(valueCell);
        tbody.appendChild(row);
    }
}


function setup() {
    const saveConfigButton = document.getElementById('saveConfig');
    saveConfigButton.addEventListener('click', saveConfiguration());
}

// wait until DOM is ready
window.addEventListener('DOMContentLoaded', setup);

if (document.readyState === 'complete') {
    loadConfiguration();
} else {
    window.addEventListener('load', loadConfiguration);
}
