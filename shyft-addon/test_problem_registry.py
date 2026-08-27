import json

import pytest

import problem_registry


@pytest.fixture
def registry(tmp_path, monkeypatch):
    path = tmp_path / "problems.json"
    monkeypatch.setattr(problem_registry, "PROBLEMS_PATH", str(path))
    return problem_registry


def test_register_creates_active_problem(registry):
    registry.register("sensor_unavailable:sensor.foo", "Sensor foo liefert keinen Wert.")
    active = registry.active_problems()
    assert len(active) == 1
    assert active[0]["id"] == "sensor_unavailable:sensor.foo"
    assert active[0]["category"] == "sensor_unavailable"
    assert active[0]["count"] == 1


def test_reoccurrence_updates_instead_of_duplicating(registry):
    registry.register("action_failed:auto_laden", "Erster Fehlversuch.")
    first_seen = registry.active_problems()[0]["firstSeen"]
    registry.register("action_failed:auto_laden", "Zweiter Fehlversuch.")
    active = registry.active_problems()
    assert len(active) == 1
    assert active[0]["count"] == 2
    assert active[0]["message"] == "Zweiter Fehlversuch."
    assert active[0]["firstSeen"] == first_seen


def test_clear_removes_only_that_key(registry):
    registry.register("input_csv_missing_data", "Stromfluss-Werte fehlen.")
    registry.register("sensor_unavailable:sensor.bar", "bar fehlt.")
    registry.clear("input_csv_missing_data")
    ids = {p["id"] for p in registry.active_problems()}
    assert ids == {"sensor_unavailable:sensor.bar"}


def test_clear_unknown_key_is_noop(registry):
    registry.clear("does_not_exist")
    assert registry.active_problems() == []


def test_clear_prefix(registry):
    registry.register("sensor_unavailable:sensor.a", "a")
    registry.register("sensor_unavailable:sensor.b", "b")
    registry.register("action_failed:auto_laden", "c")
    registry.clear_prefix("sensor_unavailable:")
    ids = {p["id"] for p in registry.active_problems()}
    assert ids == {"action_failed:auto_laden"}


def test_active_problems_newest_first(registry):
    registry.register("a", "first")
    registry.register("b", "second")
    ids = [p["id"] for p in registry.active_problems()]
    assert ids == ["b", "a"]


def test_corrupt_file_is_treated_as_empty(registry, tmp_path):
    (tmp_path / "problems.json").write_text("not json{")
    assert registry.active_problems() == []
    registry.register("a", "recovered")
    assert [p["id"] for p in registry.active_problems()] == ["a"]
    # Datei ist danach wieder gueltiges JSON
    assert isinstance(json.loads((tmp_path / "problems.json").read_text()), dict)
