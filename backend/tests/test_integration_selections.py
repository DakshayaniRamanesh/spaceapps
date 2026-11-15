"""Combined main-branch contract: selections, bounded processing and registered masks."""
from pathlib import Path
import io

import numpy as np
import pytest
from PIL import Image
from fastapi.testclient import TestClient

from app import main
from app.archive.bounded import shortlist
from app.irsa import ManifestStore, IRSAProcessor, request_key
from app.models import FieldRequest, ObservationSet
from test_real_data import FakeArchive, REQ


def test_date_spectral_and_epoch_options_are_validated_and_change_cache_keys():
    base = FieldRequest(ra=30, dec=10)
    changes = [dict(limit=24), dict(spread=True), dict(start_date='2025-01-01'),
               dict(end_date='2026-01-01'), dict(min_wavelength_um=1.2), dict(max_wavelength_um=2.4)]
    assert len({request_key(base), *(request_key(base.model_copy(update=c)) for c in changes)}) == 7
    for value in ('2025-02-30', '2025-2-3', '', 'bad'):
        with pytest.raises(ValueError):
            FieldRequest(ra=30, dec=10, start_date=value)
    rows = [{'mjd': 60000+i*10} for i in range(60)]
    monthly = shortlist(rows, base.model_copy(update={'limit': 24, 'spread': True}))
    assert len(monthly) > 12
    assert all(b['mjd']-a['mjd'] >= 29 for a,b in zip(monthly, monthly[1:]))


def test_bounded_processor_preserves_filters_and_unknown_wavelengths(tmp_path):
    store = ManifestStore(tmp_path, seeds=tmp_path/'none')
    processor = IRSAProcessor(store, FakeArchive)
    exact = processor.process(REQ.model_copy(update={'min_wavelength_um': 2., 'max_wavelength_um': 2.}))
    # The fixture has no WCS-WAVE measurement: no nominal detector value is invented.
    assert exact.frames == []
    assert any('0 of 1' in warning for warning in exact.warnings)
    assert exact.assessed_records == 1
    assert exact.request.min_wavelength_um == 2.


def test_featured_filter_views_keep_original_frames_wcs_and_honest_scope(tmp_path):
    store = ManifestStore(tmp_path)
    path = next(store.seeds.glob('*/manifest.json'))
    original_bytes = path.read_bytes()
    data = ObservationSet.model_validate_json(original_bytes)
    wave = data.frames[0].lambda_um
    req = data.request.model_copy(update={'min_wavelength_um': wave, 'max_wavelength_um': wave})
    selected = store.cached(req)
    assert selected and selected.dataset_id != data.dataset_id
    assert selected.grid == data.grid
    assert selected.frames and all(f.lambda_um == wave for f in selected.frames)
    assert not selected.search_complete
    assert 'subset' in selected.warnings[-1]
    assert path.read_bytes() == original_bytes
    assert store.load(selected.dataset_id).frames == selected.frames
    assert store.frame_path(selected.frames[0].id).is_file()


def test_mask_overlay_flips_exact_science_mask_and_does_not_change_good_pixels(monkeypatch):
    store = ManifestStore()
    data = ObservationSet.model_validate_json(next(store.seeds.glob('*/manifest.json')).read_text())
    monkeypatch.setattr(main, 'store', store)
    main.masked_frame.cache_clear()
    frame = data.frames[0]
    with np.load(store.frame_path(frame.id, 'npz'), allow_pickle=False) as arrays:
        bad = np.flipud(arrays['mask'])
    original = np.array(Image.open(store.frame_path(frame.id)).convert('RGBA'))
    response = TestClient(main.app).get(frame.image_url+'?overlay=mask')
    assert response.status_code == 200
    masked = np.array(Image.open(io.BytesIO(response.content)))
    np.testing.assert_array_equal(masked[~bad], original[~bad])
    assert np.all(masked[bad] == [245,199,125,150])
