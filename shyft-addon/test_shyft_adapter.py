from shyft_adapter import ShyftAdapter
from homeassistant_adapter import PeriodElement

from datetime import datetime
import json

def test_send_pv_history():
    expected = json.dumps({"pv_history_list":[{"state": "10","last_changed": datetime.fromisoformat("2025-05-21T18:00:00Z").isoformat()}]})
    sut = ShyftAdapter()
    given_pv_history = [PeriodElement("10", datetime.fromisoformat("2025-05-21T18:00:00Z"))]
    actual = sut._map_to_json(given_pv_history)

    assert expected == actual

def test_create_complete_uri_development_mode():
    sut = ShyftAdapter()
    sut.development_mode = True
    actual = sut._create_complete_uri("given_workflow_name")
    assert "https://shyft-power.com/version-test/api/1.1/wf/given_workflow_name" == actual

def test_create_complete_uri_prod_mode():
    sut = ShyftAdapter()
    actual = sut._create_complete_uri("given_workflow_name")
    assert "https://shyft-power.com/api/1.1/wf/given_workflow_name" == actual

def test_set_access_key_without_prefix_is_prod():
    sut = ShyftAdapter()
    sut.set_access_key("bus|123|secret")
    assert sut.bubble_token == "bus|123|secret"
    assert sut.development_mode is False

def test_set_access_key_with_test_prefix_is_dev_and_strips_prefix():
    sut = ShyftAdapter()
    sut.set_access_key("test_bus|123|secret")
    assert sut.bubble_token == "bus|123|secret"
    assert sut.development_mode is True

def test_set_access_key_empty():
    sut = ShyftAdapter()
    sut.set_access_key(None)
    assert sut.bubble_token == ""
    assert sut.development_mode is False

