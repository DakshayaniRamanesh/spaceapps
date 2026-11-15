"""Issue #4: real lookup-table interpolation, wavelength selection and API contract."""
import base64
import io
import json
from pathlib import Path

import numpy as np
import pytest
from astropy.io import fits
from astropy.wcs import WCS
from fastapi.testclient import TestClient
from pydantic import ValidationError

import app.main as main
from app.models import FieldRequest
from app.providers import SpherexIRSAProvider, SyntheticObservationProvider, field_key
from app.science.fits_loader import parse_spherex_mef
from app.services.cache import MANIFEST_CACHE

FIXTURE = Path(__file__).parent / "fixtures" / "epoch1_spherex_mef.fits"
PARAMS = {"ra": 304.6935, "dec": 42.4436, "detector": "D1", "fov_arcmin": 12}


def spectral_fits(wave=None, bandwidth=0.022):
    """Small standards-compliant 2D WAVE-TAB; no network or nominal fallback."""
    with fits.open(FIXTURE) as original:
        hdul = fits.HDUList([h.copy() for h in original if h.name != "WCS-WAVE"])
    hdr = hdul["IMAGE"].header
    hdr["WCSAXESW"] = 2
    for axis in (1, 2):
        for key, value in {"CRPIX": 0., "CRVAL": 0., "CDELT": 1., "CTYPE": "WAVE-TAB", "CUNIT": "um"}.items():
            hdr[f"{key}{axis}W"] = value
        for key, value in {"PS_0": "WCS-WAVE", "PS_1": "VALUES", "PS_2": "X" if axis == 1 else "Y", "PV_3": axis}.items():
            prefix, suffix = key.split("_")
            hdr[f"{prefix}{axis}_{suffix}W"] = value
    values = np.zeros((2, 2, 2), dtype=np.float32)
    values[..., 0] = [[0.8, 1.0], [0.84, 1.04]] if wave is None else wave
    values[..., 1] = bandwidth
    hdul.append(fits.BinTableHDU.from_columns([
        fits.Column(name="X", format="2J", array=[[1, 32]]),
        fits.Column(name="Y", format="2J", array=[[1, 32]]),
        fits.Column(name="VALUES", format="8E", dim="(2,2,2)", array=[values]),
    ], name="WCS-WAVE"))
    buffer = io.BytesIO()
    hdul.writeto(buffer)
    hdul.close()
    return buffer.getvalue()


def test_wcs_wave_is_evaluated_at_target_and_cutout_center():
    content = spectral_fits()
    with fits.open(io.BytesIO(content)) as h:
        spatial = WCS(h["IMAGE"].header)
    target = spatial.pixel_to_world(6, 12)
    at_target = parse_spherex_mef(content, target)
    assert at_target.central_wavelength_um == pytest.approx(0.8 + 0.2 * 6 / 31 + 0.04 * 12 / 31)
    assert at_target.bandwidth_um == pytest.approx(0.022)
    at_center = parse_spherex_mef(content)
    assert at_center.central_wavelength_um == pytest.approx(0.92)
    assert at_center.central_wavelength_um != at_target.central_wavelength_um
    outside = parse_spherex_mef(content, spatial.pixel_to_world(-20, 12))
    assert outside.central_wavelength_um is None
    assert outside.bandwidth_um is None


@pytest.mark.parametrize("wave,bandwidth", [(np.nan, 0.02), (0, -1), (-1, np.inf)])
def test_nonphysical_spectral_values_are_unavailable(wave, bandwidth):
    cutout = parse_spherex_mef(spectral_fits(wave, bandwidth))
    assert cutout.central_wavelength_um is None
    if not np.isfinite(bandwidth) or bandwidth <= 0:
        assert cutout.bandwidth_um is None


class ArchiveStub:
    def __init__(self, contents):
        self.contents = contents
        self.search_calls = []
        self.downloads = []

    def search_observations(self, **kwargs):
        self.search_calls.append(kwargs)
        records = [{
            "id": f"spx.D1.test{i}.6000000{i}", "obs_id": f"test{i}",
            "timestamp": f"2025-05-{i + 1:02d}T00:00:00Z",
            "access_url": f"https://irsa.ipac.caltech.edu/test{i}.fits",
            "cutout_url": f"cutout-{i}", "center_ra": kwargs["ra"],
            "center_dec": kwargs["dec"], "fov_arcmin": kwargs["fov_arcmin"],
        } for i in range(len(self.contents))]
        return records[:kwargs["max_epochs"]], len(records)

    def fetch_cutout_bytes(self, url):
        self.downloads.append(url)
        return self.contents[int(url.split("-")[-1])]


@pytest.fixture(autouse=True)
def clean_manifests():
    MANIFEST_CACHE.clear()
    yield
    MANIFEST_CACHE.clear()


@pytest.fixture
def archive():
    client = ArchiveStub([spectral_fits(0.86), spectral_fits(0.94), spectral_fits(1.03), FIXTURE.read_bytes()])
    return SpherexIRSAProvider(client=client, fixtures_mode=False), client


def test_windows_filter_actual_center_wavelength_and_preserve_epoch_selection(archive):
    provider, client = archive
    original = provider.observations(FieldRequest(**PARAMS), limit=24, spread=True, start_mjd=60000, end_mjd=62000)
    assert len(original.frames) == 4
    assert [f.wavelength_source for f in original.frames] == ["wcs-wave"] * 3 + [None]
    assert original.frames[0].bandwidth_um == pytest.approx(0.022)
    filtered = provider.observations(FieldRequest(**PARAMS, min_wavelength_um=0.9, max_wavelength_um=0.98), limit=24, spread=True, start_mjd=60000, end_mjd=62000)
    assert [f.id for f in filtered.frames] == [original.frames[1].id]
    assert filtered.total_candidates == 4
    assert filtered.epoch_selection == original.epoch_selection
    assert filtered.request.min_wavelength_um == 0.9
    assert "1 of 4 shortlisted" in filtered.notice
    assert client.search_calls[-1] == {"ra": PARAMS["ra"], "dec": PARAMS["dec"], "fov_arcmin": 12., "detector": "D1", "max_epochs": 24, "start_mjd": 60000, "end_mjd": 62000, "spread": True}
    assert len(client.downloads) == 4  # Spectral metadata reused across windows.
    assert provider.observations(FieldRequest(**PARAMS), limit=24, spread=True, start_mjd=60000, end_mjd=62000) == original
    assert original.dataset_id != filtered.dataset_id


def test_one_sided_inclusive_bounds_and_unknown_wavelengths(archive):
    provider, _ = archive
    all_frames = provider.observations(FieldRequest(**PARAMS)).frames
    wave = all_frames[1].wavelength_um
    exact = provider.observations(FieldRequest(**PARAMS, min_wavelength_um=wave, max_wavelength_um=wave))
    assert [f.id for f in exact.frames] == [all_frames[1].id]
    lower = provider.observations(FieldRequest(**PARAMS, min_wavelength_um=wave))
    upper = provider.observations(FieldRequest(**PARAMS, max_wavelength_um=wave))
    assert [f.id for f in lower.frames] == [all_frames[1].id, all_frames[2].id]
    assert [f.id for f in upper.frames] == [all_frames[0].id, all_frames[1].id]
    empty = provider.observations(FieldRequest(**PARAMS, min_wavelength_um=4.5))
    assert empty.frames == []
    assert "0 of 4 shortlisted" in empty.notice
    assert "unavailable" in empty.notice


def test_spectral_cache_is_specific_to_target_coordinate():
    client = ArchiveStub([spectral_fits()])
    provider = SpherexIRSAProvider(client=client, fixtures_mode=False)
    with fits.open(io.BytesIO(client.contents[0])) as h:
        spatial = WCS(h["IMAGE"].header)
    coords = [spatial.pixel_to_world(x, 15) for x in (4, 24)]
    frames = [provider.observations(FieldRequest(ra=c.ra.deg, dec=c.dec.deg)).frames[0] for c in coords]
    assert frames[0].id == frames[1].id
    assert frames[1].wavelength_um - frames[0].wavelength_um == pytest.approx(0.2 * 20 / 31, abs=1e-5)
    assert len(client.downloads) == 2


def test_failed_metadata_download_can_be_retried(monkeypatch):
    client = ArchiveStub([spectral_fits(0.94)])
    provider = SpherexIRSAProvider(client=client, fixtures_mode=False)
    fetch = client.fetch_cutout_bytes
    calls = 0

    def flaky(url):
        nonlocal calls
        calls += 1
        if calls == 1:
            raise TimeoutError("temporary cutout failure")
        return fetch(url)

    monkeypatch.setattr(client, "fetch_cutout_bytes", flaky)
    req = FieldRequest(**PARAMS, min_wavelength_um=0.9)
    first = provider.observations(req)
    assert first.frames == []
    assert "retry" in first.notice
    assert len(provider.observations(req).frames) == 1


@pytest.mark.parametrize("bounds", [
    {"min_wavelength_um": 0}, {"max_wavelength_um": -1},
    {"min_wavelength_um": "NaN"}, {"max_wavelength_um": "Infinity"},
    {"min_wavelength_um": ""}, {"min_wavelength_um": 1, "max_wavelength_um": 0.9},
])
def test_invalid_wavelength_bounds_are_422_before_provider_query(monkeypatch, bounds):
    class NoQuery:
        def observations(self, *args, **kwargs):
            pytest.fail("Invalid wavelength bounds reached provider")
    monkeypatch.setattr(main, "provider", NoQuery())
    assert TestClient(main.app).get("/api/observations", params={**PARAMS, **bounds}).status_code == 422
    with pytest.raises(ValidationError):
        FieldRequest(**PARAMS, **bounds)


def test_api_echoes_wavelength_filters_and_measured_metadata(monkeypatch, archive):
    provider, _ = archive
    monkeypatch.setattr(main, "provider", provider)
    response = TestClient(main.app).get("/api/observations", params={**PARAMS, "min_wavelength_um": .9, "max_wavelength_um": .98})
    assert response.status_code == 200
    body = response.json()
    assert body["request"]["max_wavelength_um"] == .98
    assert len(body["frames"]) == 1
    assert body["frames"][0]["wavelength_um"] == pytest.approx(.94)
    assert body["frames"][0]["bandwidth_um"] == pytest.approx(.022)
    assert body["frames"][0]["wavelength_source"] == "wcs-wave"


def test_synthetic_mode_rejects_filters_and_preserves_existing_frame_ids(monkeypatch):
    monkeypatch.setattr(main, "provider", SyntheticObservationProvider())
    client = TestClient(main.app)
    assert client.get("/api/observations", params={**PARAMS, "min_wavelength_um": .8}).status_code == 422
    assert client.get("/api/observations", params=PARAMS).status_code == 200
    # Numeric normalization is part of the original ID format.
    expected = {**PARAMS, "fov_arcmin": 12.0}
    legacy = base64.urlsafe_b64encode(json.dumps(expected, sort_keys=True, separators=(',', ':')).encode()).decode().rstrip('=')
    assert field_key(FieldRequest(**PARAMS)) == legacy
