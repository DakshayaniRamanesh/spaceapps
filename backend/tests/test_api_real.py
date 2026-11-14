import io
import os
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.models import FieldRequest
from app.providers import SpherexIRSAProvider


def test_spherex_irsa_provider_fixtures():
    provider = SpherexIRSAProvider(fixtures_mode=True)
    req = FieldRequest(ra=304.6935, dec=42.4436, fov_arcmin=12.0, detector="D1")
    obs = provider.observations(req)

    assert obs.source_type == "spherex-irsa"
    assert obs.intensity_unit == "MJy / sr"
    assert obs.release == "DR1+QR3"
    assert len(obs.frames) == 2

    # Frame 0
    f0 = obs.frames[0]
    assert f0.source == "spherex-irsa"
    assert f0.detector == "D1"
    assert f0.timestamp.startswith("2025-04-29")
    assert f0.quality.calibrated is True

    # Frame 1
    f1 = obs.frames[1]
    assert f1.source == "spherex-irsa"
    assert f1.detector == "D1"
    assert f1.timestamp.startswith("2025-07-28")

    # Arrays
    arr0 = provider.array(f0.id)
    arr1 = provider.array(f1.id)
    assert arr0.shape == (384, 384)
    assert arr1.shape == (384, 384)
    assert arr0.dtype == "float32"

    # Differences
    diff = arr1 - arr0
    # The moving source shifted in x, creating positive and negative residuals
    assert diff.max() > 20.0
    assert diff.min() < -20.0


def test_api_with_irsa_source(monkeypatch):
    monkeypatch.setenv("OBSERVATION_SOURCE", "irsa")
    monkeypatch.setenv("SPHEREX_FIXTURES_MODE", "1")

    # Re-import main to pick up env vars
    import importlib
    import app.main
    importlib.reload(app.main)

    client = TestClient(app.main.app)

    # Health check
    health = client.get("/health").json()
    assert health["status"] == "ok"
    assert health["source"] == "spherex-irsa"
    assert health["real_data_enabled"] is True

    # Observations
    params = {"ra": 304.6935, "dec": 42.4436, "fov_arcmin": 12.0, "detector": "D1"}
    resp = client.get("/api/observations", params=params)
    assert resp.status_code == 200
    data = resp.json()
    assert data["source_type"] == "spherex-irsa"
    assert len(data["frames"]) == 2

    frame_0_id = data["frames"][0]["id"]
    frame_1_id = data["frames"][1]["id"]

    # Frame image endpoint
    img_resp = client.get(f"/api/frames/{frame_0_id}.png")
    assert img_resp.status_code == 200
    assert img_resp.headers["x-data-source"] == "spherex-irsa"
    img = Image.open(io.BytesIO(img_resp.content))
    assert img.size == (384, 384)

    # Difference image endpoint (diff mode)
    diff_resp = client.get(f"/api/difference?frame_a={frame_0_id}&frame_b={frame_1_id}")
    assert diff_resp.status_code == 200
    assert diff_resp.headers["x-data-source"] == "spherex-irsa"
    assert diff_resp.headers["x-difference-sign"] == "B-minus-A"
    diff_img = Image.open(io.BytesIO(diff_resp.content))
    assert diff_img.size == (384, 384)

    # Difference image endpoint (significance mode)
    sig_resp = client.get(f"/api/difference?frame_a={frame_0_id}&frame_b={frame_1_id}&view=significance")
    assert sig_resp.status_code == 200
    assert sig_resp.headers["x-data-source"] == "spherex-irsa"
    assert sig_resp.headers["x-difference-view"] == "significance"
    sig_img = Image.open(io.BytesIO(sig_resp.content))
    assert sig_img.size == (384, 384)

    # Gaia catalog endpoint test
    gaia_resp = client.get("/api/catalog/gaia", params={"ra": 304.6935, "dec": 42.4436, "fov_arcmin": 12.0})
    assert gaia_resp.status_code == 200
    gaia_data = gaia_resp.json()
    assert gaia_data["catalog"] == "Gaia DR3"
    assert gaia_data["epoch"] == "J2016.0"
    assert "sources" in gaia_data

    # Reset monkeypatch and reload main
    monkeypatch.undo()
    importlib.reload(app.main)
