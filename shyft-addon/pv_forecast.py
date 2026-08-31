"""PV-Erzeugungsprognose im Addon - loest die frueher bubble-seitige "PV Prediction" ab.

Ansatz (siehe Nutzer-Excel PV_Prediction_v2):

- open-meteo liefert stuendlich `global_tilted_irradiance` (W/m^2, feste 35 Grad Suedausrichtung),
  `temperature_2m` (Grad C) und `weather_code`, fuer 7 Tage Vergangenheit + 3 Tage Zukunft.
- Pro PV-Anlage (aktuell genau eine) wird ein "m^2-Aequivalent" je Tagesstunde 0..23 gelernt:
  die hypothetische Kollektorflaeche, die - mal Einstrahlung mal 0.2 (grober Anlagenwirkungsgrad) -
  die tatsaechlich gemessene Leistung ergibt. Stundenweise, weil Verschattung/Cosinus je Tageszeit
  unterschiedlich wirken.
- Prognose_kW(i) = (irr[i]+irr[i+1])/2 / 1000 * m2[i mod 24] * 0.2; 0, wenn (irr[i]+irr[i+1]) < 4.
  (irr[i] ist bei open-meteo das Mittel der VORaus­gehenden Stunde - der Mittelwert aus i und i+1
  schaetzt die Einstrahlung im Intervall [i, i+1], was v.a. morgens/abends genauer ist.)
  Darauf ein Sicherheitsabschlag von 5 % + 100 W: real soll eher etwas MEHR PV anliegen als
  prognostiziert (z.B. um die Batterie sicher vollzubekommen).
- Kalibrierung: taeglich 22:00 lokal mit den Messwerten des laufenden Tages, sowie einmalig bei
  Erstkonfiguration ueber 7 Tage Historie. m2[h] wird per EWMA (alpha=0.25) Richtung des aus der
  gemessenen Leistung implizierten Wertes geglaettet - der Altwert dominiert, ein einzelner
  Ausreissertag verzieht die Prognose also nur wenig.

Persistenz: /data/weather_forecast.json (open-meteo-Cache), /data/pv_calibration.json (m2[]).
"""

import json
import time
from datetime import datetime, timedelta, timezone

import requests

WEATHER_CACHE_PATH = "/data/weather_forecast.json"
PV_CALIBRATION_PATH = "/data/pv_calibration.json"

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
# Feste Annahme statt Nutzer-Konfiguration: 35 Grad Neigung, Suedausrichtung (open-meteo:
# azimuth 0 = Sued). global_tilted_irradiance liefert damit direkt die Strahlung in der Modulebene.
PV_TILT_DEG = 35
PV_AZIMUTH_DEG = 0
OPEN_METEO_PAST_DAYS = 7
OPEN_METEO_FORECAST_DAYS = 3

# kW = W/m^2 / 1000 * m^2 * WIRKUNGSGRAD. Der Wirkungsgrad ist bewusst grob und konstant - die
# eigentliche Anpassung an die Anlage passiert ueber das gelernte m2[].
PV_EFFICIENCY = 0.2
# Unter dieser Summe zweier Stunden-Einstrahlungswerte wird 0 kW prognostiziert (Nacht/Daemmerung).
IRRADIANCE_ZERO_THRESHOLD_WM2 = 4
# Sicherheitsabschlag auf die Prognose (siehe Modulbeschreibung).
SAFETY_FACTOR = 0.95
SAFETY_OFFSET_KW = 0.1

# EWMA-Glaettung der m2-Kalibrierung. alpha klein -> traege, robust gegen einen Ausreissertag.
CALIBRATION_ALPHA = 0.25
# Nur Stunden mit belastbarer Einstrahlung fliessen in die m2-Anpassung ein (sonst ist
# gemessen / (irr * eta) numerisch instabil).
CALIBRATION_MIN_IRRADIANCE_WM2 = 50
# Messfenster um die volle Stunde (+/- Minuten), aus dem der Stundenwert gemittelt wird.
CALIBRATION_HOUR_WINDOW_MIN = 30
CALIBRATION_SETUP_DAYS = 7

# Grobes Startprofil, bevor kalibriert wurde: ~50 m^2 in den Tagesstunden, 0 nachts. Zusammen mit
# der echten Einstrahlungsprognose ergibt das am Tag 1 schon eine plausible Glockenkurve.
DEFAULT_M2_PROFILE = [0.0] * 4 + [50.0] * 18 + [0.0] * 2  # Stunden 4..21 = 50


def _read_json(path):
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception:
        return None


def _write_json(path, data):
    try:
        with open(path, "w") as f:
            json.dump(data, f)
        return True
    except Exception as e:
        print(f"[Shyft] {path} konnte nicht gespeichert werden:", repr(e))
        return False


# ---------------------------------------------------------------------------
# open-meteo
# ---------------------------------------------------------------------------

def fetch_weather(latitude, longitude):
    "Holt die open-meteo-Prognose (7 Tage Vergangenheit + 3 Tage Zukunft) und schreibt sie in den Cache. Gibt den Cache-Dict zurueck oder None bei Fehler."
    if latitude is None or longitude is None:
        print("[Shyft] Wetter-Fetch uebersprungen: keine Koordinaten (zone.home).")
        return None
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": "global_tilted_irradiance,temperature_2m,weather_code",
        "tilt": PV_TILT_DEG,
        "azimuth": PV_AZIMUTH_DEG,
        "timezone": "Europe/Berlin",
        "past_days": OPEN_METEO_PAST_DAYS,
        "forecast_days": OPEN_METEO_FORECAST_DAYS,
        "timeformat": "unixtime",
    }
    try:
        response = requests.get(OPEN_METEO_URL, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print("[Shyft] open-meteo-Abruf fehlgeschlagen:", repr(e))
        return None

    hourly = data.get("hourly") or {}
    cache = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "latitude": latitude,
        "longitude": longitude,
        "utc_offset_seconds": data.get("utc_offset_seconds"),
        "time": hourly.get("time") or [],                                  # unix-Sekunden je Ortsstunde
        "gti": hourly.get("global_tilted_irradiance") or [],               # W/m^2
        "temperature": hourly.get("temperature_2m") or [],                 # Grad C
        "weather_code": hourly.get("weather_code") or [],                  # WMO
    }
    if not cache["time"] or not cache["gti"]:
        print("[Shyft] open-meteo-Antwort ohne stuendliche Daten - Cache nicht aktualisiert.")
        return None
    _write_json(WEATHER_CACHE_PATH, cache)
    return cache


def weather_cache_age_hours():
    "Alter des Wetter-Caches in Stunden, oder None wenn kein Cache."
    cache = _read_json(WEATHER_CACHE_PATH)
    if not cache or not cache.get("fetched_at"):
        return None
    try:
        fetched = datetime.fromisoformat(cache["fetched_at"])
    except ValueError:
        return None
    return (datetime.now(timezone.utc) - fetched).total_seconds() / 3600


# ---------------------------------------------------------------------------
# Zeitraster
# ---------------------------------------------------------------------------

def _local_midnight_today():
    "Heutige 0:00 Uhr lokaler (Container-)Zeit als aware datetime - die Container-TZ entspricht bei einer normalen HAOS/Supervised-Installation der in HA konfigurierten Zeitzone (Europe/Berlin)."
    now_local = datetime.now().astimezone()
    return now_local.replace(hour=0, minute=0, second=0, microsecond=0)


def _cache_index_for(cache, dt_local):
    "Index in cache['time'] (unix-Sekunden) fuer den lokalen Stundenzeitpunkt dt_local, oder None."
    target = int(dt_local.timestamp())
    times = cache.get("time") or []
    try:
        return times.index(target)
    except ValueError:
        # Falls exakte Sekunde nicht matcht (DST-Rand o.ae.): naechstliegende Stunde suchen
        best = None
        for i, t in enumerate(times):
            if abs(t - target) <= 1800:
                best = i
                break
        return best


# ---------------------------------------------------------------------------
# Prognose
# ---------------------------------------------------------------------------

def is_calibrated():
    "True, wenn bereits eine gueltige m2-Kalibrierung persistiert ist (siehe _read_calibration)."
    return _read_calibration()[1] is not None


def _read_calibration():
    "Gibt (m2[24], last_calibrated_date_or_None) zurueck - Startprofil, falls noch nicht kalibriert."
    data = _read_json(PV_CALIBRATION_PATH) or {}
    m2 = data.get("m2")
    if not isinstance(m2, list) or len(m2) != 24:
        return list(DEFAULT_M2_PROFILE), None
    try:
        m2 = [max(0.0, float(v)) for v in m2]
    except (TypeError, ValueError):
        return list(DEFAULT_M2_PROFILE), None
    return m2, data.get("last_calibrated")


def _write_calibration(m2, last_calibrated_date, extra=None):
    payload = {"m2": [round(v, 3) for v in m2], "last_calibrated": last_calibrated_date}
    if extra:
        payload.update(extra)
    _write_json(PV_CALIBRATION_PATH, payload)


def _pv_kw_series(gti, m2, count):
    """Stundenweise kW-Prognose fuer die ersten `count` Stunden ab gti[0]. gti muss mindestens
    count+1 Werte haben (fuer den (irr[i]+irr[i+1])/2-Mittelwert)."""
    result = []
    for i in range(count):
        irr_i = gti[i] if i < len(gti) and gti[i] is not None else 0.0
        irr_next = gti[i + 1] if i + 1 < len(gti) and gti[i + 1] is not None else irr_i
        if (irr_i + irr_next) < IRRADIANCE_ZERO_THRESHOLD_WM2:
            result.append(0.0)
            continue
        raw_kw = (irr_i + irr_next) / 2 / 1000 * m2[i % 24] * PV_EFFICIENCY
        result.append(max(0.0, raw_kw * SAFETY_FACTOR - SAFETY_OFFSET_KW))
    return result


def compute_site_weather_fields(period, pv_sensor_configured):
    """Baut die drei neuen Site-Felder (siehe update_site_addon-Endpunkt):
      - datetimeWeatherMs: `period` Unix-ms-Timestamps ab heute 0:00 lokal (immer, auch ohne Cache)
      - temperature:      komma-separierte `period` Grad-C-Werte (0, wenn kein Cache)
      - pvPrediction:     komma-separierte `period` kW-Werte (0, wenn kein Cache / kein PV-Sensor)
    Zusaetzlich weatherCode (nur fuers Addon-Dashboard, geht NICHT an die Site).
    Liefert immer ein Dict - fehlende Daten werden als Nullen gefuellt, damit die (Pflicht-)
    Endpunkt-Parameter nie leer sind."""
    midnight = _local_midnight_today()
    datetimes_ms = [int((midnight + timedelta(hours=i)).timestamp() * 1000) for i in range(period)]

    cache = _read_json(WEATHER_CACHE_PATH)
    start = _cache_index_for(cache, midnight) if cache else None

    if cache is None or start is None:
        zeros = ["0"] * period
        return {
            "datetimeWeatherMs": datetimes_ms,
            "temperature": ",".join(zeros),
            "pvPrediction": ",".join(zeros),
            "weatherCode": [None] * period,
        }

    gti = (cache.get("gti") or [])[start:start + period + 1]
    temps = (cache.get("temperature") or [])[start:start + period]
    codes = (cache.get("weather_code") or [])[start:start + period]

    temps = [(t if t is not None else 0.0) for t in temps] + [0.0] * (period - len(temps))
    codes = [(c if c is not None else None) for c in codes] + [None] * (period - len(codes))

    if pv_sensor_configured:
        m2, _ = _read_calibration()
        pv_kw = _pv_kw_series(gti, m2, period)
    else:
        pv_kw = [0.0] * period

    return {
        "datetimeWeatherMs": datetimes_ms,
        "temperature": ",".join(f"{t:.1f}" for t in temps[:period]),
        "pvPrediction": ",".join(f"{v:.3f}" for v in pv_kw[:period]),
        "weatherCode": codes[:period],
    }


def dashboard_weather(pv_sensor_configured=True):
    "Kompakte Wetter-/PV-Prognose-Struktur fuer das Dashboard (siehe /dashboard/weather in app.py)."
    period = 48
    fields = compute_site_weather_fields(period, pv_sensor_configured=pv_sensor_configured)
    return {
        "datetimes": fields["datetimeWeatherMs"],
        "temperature": [None if x == "" else float(x) for x in fields["temperature"].split(",")],
        "pvPrediction": [float(x) for x in fields["pvPrediction"].split(",")],
        "weatherCode": fields["weatherCode"],
    }


# ---------------------------------------------------------------------------
# Kalibrierung
# ---------------------------------------------------------------------------

def _hourly_measured_kw(history_pairs, day_local, hour):
    """Mittelwert der gemessenen Leistung (kW) im Fenster [hour:00 +/- CALIBRATION_HOUR_WINDOW_MIN]
    an day_local. history_pairs: Liste (aware_datetime, kw). None, wenn keine Messpunkte im Fenster."""
    center = day_local.replace(hour=hour, minute=0, second=0, microsecond=0)
    lo = center - timedelta(minutes=CALIBRATION_HOUR_WINDOW_MIN)
    hi = center + timedelta(minutes=CALIBRATION_HOUR_WINDOW_MIN)
    vals = [kw for (ts, kw) in history_pairs if lo <= ts <= hi]
    if not vals:
        return None
    return sum(vals) / len(vals)


def _irr_avg_at(cache, day_local, hour):
    "(gti[h] + gti[h+1]) / 2 aus dem Cache fuer die lokale Stunde, oder None."
    if not cache:
        return None
    idx = _cache_index_for(cache, day_local.replace(hour=hour, minute=0, second=0, microsecond=0))
    gti = cache.get("gti") or []
    if idx is None or idx + 1 >= len(gti):
        return None
    a, b = gti[idx], gti[idx + 1]
    if a is None or b is None:
        return None
    return (a + b) / 2


def calibrate(history_pairs, days, from_default=False):
    """Aktualisiert m2[] per EWMA gegen den aus der gemessenen Leistung implizierten Wert.
    history_pairs: Liste (aware_datetime, kw) der PV-Sensor-Historie. `days`: wie viele
    zurueckliegende Kalendertage (inkl. heute) einbezogen werden. from_default=True setzt vor der
    Anpassung auf DEFAULT_M2_PROFILE zurueck (Erstkalibrierung)."""
    cache = _read_json(WEATHER_CACHE_PATH)
    if not cache:
        print("[Shyft] PV-Kalibrierung: kein Wetter-Cache, uebersprungen.")
        return

    m2, _ = (list(DEFAULT_M2_PROFILE), None) if from_default else _read_calibration()

    today = _local_midnight_today()
    updated_hours = 0
    for day_offset in range(days - 1, -1, -1):  # aeltester Tag zuerst -> Konvergenz
        day_local = today - timedelta(days=day_offset)
        for hour in range(24):
            irr_avg = _irr_avg_at(cache, day_local, hour)
            if irr_avg is None or irr_avg < CALIBRATION_MIN_IRRADIANCE_WM2:
                continue
            measured_kw = _hourly_measured_kw(history_pairs, day_local, hour)
            if measured_kw is None:
                continue
            m2_implied = measured_kw / (irr_avg / 1000 * PV_EFFICIENCY)
            m2[hour] = max(0.0, (1 - CALIBRATION_ALPHA) * m2[hour] + CALIBRATION_ALPHA * m2_implied)
            updated_hours += 1

    _write_calibration(m2, today.date().isoformat(), extra={"updated_hours_last_run": updated_hours})
    print(f"[Shyft] PV-Kalibrierung: {updated_hours} Stunden-Buckets angepasst (m2-Summe {sum(m2):.0f}).")
