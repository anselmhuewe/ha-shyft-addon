"""Zentrale Sammelstelle fuer laufende, fuer den Nutzer relevante Probleme des Add-ons
(fehlgeschlagene Aktionen, fehlende/unavailable Sensordaten, ...) - Grundlage der
Fehler-/Statuskarte oben auf der Konfigurationsseite (siehe /system-health in app.py und
renderSystemHealth in www/app.js).

Bewusst als eigenes Modul ohne Import auf app.py gebaut, damit sowohl app.py als auch
sync_service.py Probleme melden und wieder freigeben koennen, ohne einen Import-Zyklus zu
erzeugen (app.py importiert sync_service).

Ein Problem wird ueber eine stabile String-ID identifiziert, z.B. "action_failed:auto_laden",
"input_csv_missing_data" oder "sensor_unavailable:<entity_id>". Tritt dasselbe Problem erneut
auf, wird nur der Zeitstempel und der Zaehler aktualisiert - es entsteht kein Duplikat. Laeuft
der zugehoerige Code-Pfad wieder erfolgreich durch, MUSS er dieselbe ID aktiv wieder freigeben
(clear) - es gibt bewusst kein automatisches Verfallsdatum, damit ein Problem nicht faelschlich
"von selbst" verschwindet, solange es tatsaechlich noch besteht.

Persistiert nach /data/problems.json, wie die uebrigen Addon-Zustandsdateien (config.json,
dashboard_cache.json, ...).
"""

import json
import threading
from datetime import datetime, timezone

PROBLEMS_PATH = "/data/problems.json"
# Die Karte zeigt maximal so viele Klartext-Zeilen - alles darueber wird nur noch gezaehlt.
MAX_VISIBLE_PROBLEMS = 5

# RLock, damit ein Aufrufer, der schon die Sperre haelt, gefahrlos eine zweite Registry-Funktion
# aufrufen kann.
_lock = threading.RLock()


def _read():
    try:
        with open(PROBLEMS_PATH, "r") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _write(problems):
    try:
        with open(PROBLEMS_PATH, "w") as f:
            json.dump(problems, f)
    except Exception as e:
        print("[Shyft] Problem-Registry konnte nicht gespeichert werden:", repr(e))


def register(problem_id, message, category=None):
    "Meldet ein aktives Problem oder aktualisiert ein bereits bekanntes (lastSeen + count hochzaehlen, firstSeen bleibt)."
    if not problem_id or not message:
        return
    now = datetime.now(timezone.utc).isoformat()
    with _lock:
        problems = _read()
        existing = problems.get(problem_id) or {}
        problems[problem_id] = {
            "id": problem_id,
            "message": message,
            "category": category or existing.get("category") or problem_id.split(":", 1)[0],
            "count": int(existing.get("count", 0)) + 1,
            "firstSeen": existing.get("firstSeen") or now,
            "lastSeen": now,
        }
        _write(problems)


def clear(problem_id):
    "Gibt eine Problem-ID wieder frei - vom erfolgreichen Code-Pfad selbst aufzurufen. No-op, wenn die ID gar nicht aktiv war."
    if not problem_id:
        return
    with _lock:
        problems = _read()
        if problem_id in problems:
            del problems[problem_id]
            _write(problems)


def clear_prefix(prefix):
    "Gibt alle IDs mit gegebenem Praefix frei - z.B. 'sensor_unavailable:<entity_id>' wenn ein Sensor neu zugeordnet/entfernt wurde."
    if not prefix:
        return
    with _lock:
        problems = _read()
        to_delete = [key for key in problems if key.startswith(prefix)]
        for key in to_delete:
            del problems[key]
        if to_delete:
            _write(problems)


def active_problems():
    "Alle aktiven Probleme, neueste zuerst (nach lastSeen) - das Frontend zeigt die ersten MAX_VISIBLE_PROBLEMS als Klartext."
    with _lock:
        problems = list(_read().values())
    problems.sort(key=lambda p: p.get("lastSeen", ""), reverse=True)
    return problems


def is_active(problem_id):
    "True, wenn genau diese Problem-ID aktuell registriert ist - z.B. als Sicherheits-Gate, bevor ein Wert aus der juengsten Historie einer Entitaet uebernommen wird, deren letzte Aktion evtl. fehlgeschlagen ist (siehe compute_hw_soc_min)."
    with _lock:
        return problem_id in _read()
