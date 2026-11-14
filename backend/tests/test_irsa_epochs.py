from __future__ import annotations

import math

import pytest
from astropy.table import Table
from astroquery.ipac.irsa.core import IrsaClass

from app.archive.irsa_client import IrsaSpherexClient, mjd_to_utc_iso


def make_sia_table(visits: int = 18) -> Table:
    rows = [
        (f"visit-{visit}-{exposure}", 60000 + visit * 30 + exposure / 24,
         f"https://irsa.ipac.caltech.edu/{visit}-{exposure}.fits",
         "SPHEREx-D1", "spherex_dr1")
        for visit in range(visits)
        for exposure in range(2)
    ]
    return Table(
        rows=rows,
        names=("obs_id", "t_min", "access_url", "energy_bandpassname", "obs_collection"),
    )


@pytest.fixture
def client(tmp_path, monkeypatch):
    result = make_sia_table()
    calls = 0

    def query_sia(_self, **_kwargs):
        nonlocal calls
        calls += 1
        return result

    monkeypatch.setattr(IrsaClass, "query_sia", query_sia)
    instance = IrsaSpherexClient(cache_dir=tmp_path)
    return instance, lambda: calls, result


def test_default_limit_and_candidate_count(client):
    instance, _, _ = client
    records, total = instance.search_observations(10, 10, 12, "D1")
    assert len(records) == 12
    assert total == 36
    assert [record["mjd"] for record in records] == sorted(
        record["mjd"] for record in records
    )


def test_limit_50_returns_all_candidates_and_keeps_ids_stable(client):
    instance, _, _ = client
    default, _ = instance.search_observations(10, 10, 12, "D1")
    expanded, total = instance.search_observations(
        10, 10, 12, "D1", max_epochs=50
    )
    assert len(expanded) == 36
    assert total == 36
    assert [record["id"] for record in default] == [
        record["id"] for record in expanded[:12]
    ]


def test_spread_selection_uses_monthly_bins_and_minimum_gap(client):
    instance, _, _ = client
    records, _ = instance.search_observations(
        10, 10, 12, "D1", max_epochs=50, spread=True
    )
    mjds = [record["mjd"] for record in records]
    assert len(records) == 18
    assert all(right - left >= 29 for left, right in zip(mjds, mjds[1:]))


def test_date_window_filters_before_counting(client):
    instance, _, _ = client
    records, total = instance.search_observations(
        10, 10, 12, "D1", max_epochs=50, start_mjd=60100, end_mjd=60200
    )
    assert total == 6
    assert len(records) == 6
    assert all(60100 <= record["mjd"] <= 60200 for record in records)


def test_rows_without_valid_times_are_dropped(tmp_path):
    table = Table(
        {
            "obs_id": ["zero", "nan", "negative", "valid"],
            "t_min": [0.0, math.nan, -1.0, 60001.0],
            "access_url": ["https://irsa.ipac.caltech.edu/a.fits"] * 4,
            "energy_bandpassname": ["SPHEREx-D1"] * 4,
            "obs_collection": ["spherex_dr1"] * 4,
        }
    )
    instance = IrsaSpherexClient(cache_dir=tmp_path)
    instance.query_sia_table = lambda *_args: table
    records, total = instance.search_observations(10, 10, 12, "D1", max_epochs=50)
    assert total == 1
    assert len(records) == 1
    assert records[0]["obs_id"] == "valid"
    assert "1970-01-01" not in records[0]["timestamp"]


def test_missing_t_min_column_and_detector_mismatch_return_no_records(client):
    instance, _, table = client
    table.remove_column("t_min")
    assert instance.search_observations(10, 10, 12, "D1") == ([], 0)
    assert instance.search_observations(10, 10, 12, "D2") == ([], 0)


def test_position_query_cache_is_shared_across_selection_changes(client):
    instance, call_count, _ = client
    instance.search_observations(10, 10, 12, "D1", max_epochs=12)
    instance.search_observations(
        10, 10, 12, "D1", max_epochs=50, spread=True,
        start_mjd=60100, end_mjd=60200,
    )
    assert call_count() == 1


def test_sia_timeout_is_reported_as_a_failure_not_empty_coverage(tmp_path, monkeypatch):
    instance = IrsaSpherexClient(cache_dir=tmp_path, timeout=0.01)

    def fail_request(**_kwargs):
        raise TimeoutError("IRSA did not respond")

    monkeypatch.setattr(instance._irsa, "query_sia", fail_request)
    with pytest.raises(RuntimeError, match="IRSA SIA observation discovery failed"):
        instance.search_observations(10, 10, 12, "D1")


def test_invalid_mjd_does_not_get_a_substitute_timestamp():
    with pytest.raises(ValueError, match="Invalid observation MJD"):
        mjd_to_utc_iso(math.nan)
