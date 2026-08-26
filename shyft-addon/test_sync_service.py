from sync_service import SyncService
from homeassistant_adapter import HomeAssistantAdapter
from shyft_adapter import ShyftAdapter

import pytest
from datetime import datetime

@pytest.fixture
def sut():
    return SyncService(HomeAssistantAdapter(supervisor_token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJlOGQyNjEwZmMwOWQ0MzY3OTQ5YzcyZDc4ZjA2MzliMyIsImlhdCI6MTc2MDA5Njc2NiwiZXhwIjoyMDc1NDU2NzY2fQ.uzrb_9GI--oKn6Wt6Oopz-lweUWXV0Q4ABbwxmAiiJo"),
                       ShyftAdapter(bubble_token="XXXX"),
                       "shyft-addon/test_shyft_config.json")

def test_sync_pv_history(sut):
    sut.sync_pv_history()

def test_collect_live_values(sut):
    sut.collect_live_values()

def test_load_config(sut):
    actual = sut._load_config()
    assert actual["sensorMappings"]["photovoltaic_powerflow_pv"] == "sensor.heatpump_mock_the_sensor_mock"

def test_calculate_dates_01(sut):
    given_now = datetime(2026, 1, 23, hour=21, minute=0)
    actual = sut._calculate_dates(given_now)
    assert actual["end_timestamp"] == datetime(2026, 1, 23, hour=21, minute=0)
    assert actual["start_timestamp"] == datetime(2026, 1, 23, hour=4, minute=0)

def test_calculate_dates_02(sut):
    given_now = datetime(2026, 1, 23, hour=3, minute=0)
    actual = sut._calculate_dates(given_now)
    assert actual["end_timestamp"] == datetime(2026, 1, 23, hour=3, minute=0)
    assert actual["start_timestamp"] == datetime(2026, 1, 22, hour=4, minute=0)
