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
    # Production route uses the bounded job/store pipeline, not the legacy
    # synchronous provider. No service calls or global module reloads in tests.
    from app import main
    monkeypatch.setattr(main, "source", "irsa")
    from pathlib import Path
    from app.models import ObservationSet
    path = next((Path(__file__).parents[1]/"data"/"featured").glob("*/manifest.json"))
    data = ObservationSet.model_validate_json(path.read_text())
    client = TestClient(main.app)
    health = client.get("/health").json()
    assert health["real_data_enabled"] and not health["scientific_subtraction_enabled"]
    job = client.post("/api/observation-jobs", json=data.request.model_dump())
    assert job.status_code == 200 and job.json()["status"] == "ready"
    loaded = client.get(job.json()["result_url"]).json()
    assert loaded["source_type"] == "spherex-irsa"
    first, last = loaded["frames"][0], loaded["frames"][-1]
    for suffix in ("", "?overlay=mask"):
        response = client.get(first["image_url"]+suffix)
        assert response.status_code == 200
        assert Image.open(io.BytesIO(response.content)).size == (data.width, data.height)
    assert client.get(first["image_url"]+"?overlay=invalid").status_code == 422
    for view in ("diff", "significance"):
        response = client.get("/api/difference", params={"frame_a":first["id"], "frame_b":last["id"], "view":view})
        assert response.status_code == 422
    for limit in (1, 51, "abc"):
        assert client.get("/api/observations", params={**data.request.model_dump(exclude_none=True), "limit":limit}).status_code == 422
    for dates in ({"start_date":"2025-13-99"}, {"start_date":"2026-01-01", "end_date":"2025-01-01"}):
        assert client.post("/api/observation-jobs", json={**data.request.model_dump(), **dates}).status_code == 422
