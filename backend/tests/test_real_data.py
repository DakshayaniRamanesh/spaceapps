import io
import json
from pathlib import Path
import threading
import time

import httpx
import numpy as np
import pytest
from astropy.io import fits
from fastapi.testclient import TestClient
from PIL import Image

from app.archive import ArchiveClient, ArchiveUnavailable, BudgetExceeded, validate_archive_url, shortlist
from app.irsa import ManifestStore, IRSAProcessor, request_key
from app.jobs import JobManager, QueueFull
from app.models import FieldRequest, ObservationSet, Quality
from app.science import Prepared, bilinear, flags_mask, prepare_fits, target_grid, real_png, pair_report
from app import main

REQ = FieldRequest(ra=30, dec=10, fov_arcmin=2, detector='D3')
URL = 'https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/test/sample.fits'


def fits_fixture():
    """Artificial FITS test data; never served as a NASA observation."""
    w, size = target_grid(FieldRequest(ra=30, dec=10, fov_arcmin=3))
    shape = (size, size)
    header = w.to_header()
    header['BUNIT'], header['DATE-OBS'] = 'MJy/sr', '2026-01-02T03:04:05.123'
    image = fits.ImageHDU(np.full(shape, 10, dtype='float32'), header, name='IMAGE')
    flags = fits.ImageHDU(np.zeros(shape, dtype='int32'), name='FLAGS')
    flags.header['MSKN0021'] = 'SOURCE'
    hdus = fits.HDUList([fits.PrimaryHDU(), image, flags,
                         fits.ImageHDU(np.full(shape, 4, dtype='float32'), name='VARIANCE'),
                         fits.ImageHDU(np.full(shape, 2, dtype='float32'), name='ZODI'),
                         fits.BinTableHDU(name='WCS-WAVE')])
    output = io.BytesIO()
    hdus.writeto(output)
    return output.getvalue()


def test_fits_units_time_foreground_and_common_grid():
    p = prepare_fits(fits_fixture(), REQ)
    assert p.intensity.shape == (20, 20)
    np.testing.assert_allclose(p.intensity, 8)
    assert p.timestamp == '2026-01-02T03:04:05.123Z'
    assert p.lambda_um is None  # Unknown wavelengths never become invented bands.
    assert len(p.sha256) == 64
    assert p.quality.calibrated
    assert p.quality.valid_fraction == 1


def test_bad_flag_policy_retains_status_and_masks_unknown_bits():
    flags = np.array([0, 1 << 21, 1 << 12, 1 << 6, 1 << 30], dtype=np.uint32)
    bad, counts = flags_mask(flags, {'MSKN0021': 'SOURCE', 'MSKN0012': 'FULLSAMPLE', 'MSKN0006': 'NONFUNC'})
    assert bad.tolist() == [False, False, False, True, True]
    assert counts['SOURCE'] == 1


def test_masked_center_is_explicit_even_when_most_of_the_field_is_valid():
    with fits.open(io.BytesIO(fits_fixture())) as h:
        h['FLAGS'].header['MSKN0006'] = 'NONFUNC'
        h['FLAGS'].data[12:18, 12:18] = 1 << 6
        stream = io.BytesIO()
        h.writeto(stream)
    p = prepare_fits(stream.getvalue(), REQ)
    assert p.quality.valid_fraction > .8
    assert p.quality.center_valid is False
    assert p.quality.center_region_valid_fraction < .8
    report = pair_report('a', 'b', p, p)
    assert next(c for c in report.checks if c.name == 'Center-region coverage').status == 'blocked'


def test_interpolation_propagates_variance_with_squared_weights_and_preserves_holes():
    image = np.array([[1, 2], [3, 4]], dtype=float)
    variance = np.full((2, 2), 4.)
    value, var = bilinear(image, variance, np.array([[.5]]), np.array([[.5]]))
    assert value[0, 0] == 2.5
    assert var[0, 0] == 1  # Reprojecting variance as an intensity would incorrectly give 4.
    image[0, 0] = np.nan
    value, var = bilinear(image, variance, np.array([[.5]]), np.array([[.5]]))
    assert np.isnan(value[0, 0]) and np.isnan(var[0, 0])


def test_display_flips_fits_origin_and_keeps_missing_pixels_transparent():
    a = np.array([[0, np.nan], [1, .5]])
    image = np.array(Image.open(io.BytesIO(real_png(a, {'low': 0, 'high': 1, 'asinh_softening': .08}))))
    assert image[0, 0, 0] > image[1, 0, 0]
    assert image[1, 1, 3] == 0


def prepared(wave):
    a = np.ones((20, 20), dtype=np.float32)
    return Prepared(a, a, wave, a*.04, Quality(), '2026-01-01T00:00:00Z', 2., .04, 'test', '0'*64)


def test_matching_center_does_not_approve_mismatched_field_or_subtraction():
    a, b = np.full((20, 20), 2.), np.full((20, 20), 2.2)
    b[10, 10] = 2.
    report = pair_report('a', 'b', prepared(a), prepared(b))
    assert report.comparison_status == 'blocked'
    assert report.spectral_overlap_fraction < .01
    assert not report.difference_allowed
    other = prepared(a)
    other.timestamp = '2026-02-01T00:00:00Z'
    report = pair_report('a', 'b', prepared(a), other)
    assert report.comparison_status == 'preview'
    assert not report.difference_allowed  # Unknown PSF/calibration never counts as a pass.
    assert pair_report('a', 'b', prepared(a), prepared(a)).comparison_status == 'blocked'


@pytest.mark.parametrize('url', [
    'http://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/test.fits',
    'https://evil.test/ibe/data/spherex/dr1/level2/test.fits',
    'https://irsa.ipac.caltech.edu.evil.test/test.fits',
    'https://irsa.ipac.caltech.edu:444/ibe/data/spherex/dr1/level2/test.fits',
    URL+'?redirect=evil', URL.replace('test/', '../'), URL.replace('test/', '%2e%2e/'),
])
def test_archive_url_allowlist(url):
    with pytest.raises(ValueError):
        validate_archive_url(url)


def test_redirects_and_oversized_responses_are_rejected():
    c = ArchiveClient(client=httpx.Client(transport=httpx.MockTransport(
        lambda r: httpx.Response(302, headers={'Location': 'https://evil.test/'}))))
    with pytest.raises(ArchiveUnavailable):
        c.read(URL)
    c.close()
    c = ArchiveClient(client=httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, content=b'x'*100))))
    with pytest.raises(BudgetExceeded):
        c.read(URL, limit=99)
    c.close()


def test_shortlist_spans_dates_instead_of_first_records():
    rows = [{'mjd': i} for i in range(100)]
    chosen = shortlist(rows)
    assert len(chosen) == 12
    assert chosen[0]['mjd'] == 0 and chosen[-1]['mjd'] == 99


class FakeArchive:
    records = [{'obs_id': 'test-fixture', 'access_url': URL, 'collection': 'spherex_dr1', 'mjd': 61042}]
    def discover(self, req):
        return self.records, True, []
    def cutout(self, row, req):
        return fits_fixture(), URL+'?center=30,10&size=0.05'
    def close(self):
        pass


def test_processor_cache_provenance_and_single_epoch(tmp_path):
    store = ManifestStore(tmp_path, seeds=tmp_path/'no-seeds')
    processor = IRSAProcessor(store, FakeArchive)
    data = processor.process(REQ)
    assert data.availability == 'single_epoch'
    assert data.source_type == 'spherex-irsa'
    assert data.frames[0].obs_id == 'test-fixture'
    assert data.intensity_unit == 'MJy/sr'
    assert processor.process(REQ).model_dump() == data.model_dump()
    assert store.frame_path(data.frames[0].id).is_file()
    np.testing.assert_allclose(store.array(data.frames[0].id), 8)
    with pytest.raises(ValueError):
        store.frame_path('../../secret')


def test_no_coverage_requires_completed_archive_query(tmp_path):
    class Empty(FakeArchive):
        records = []
    data = IRSAProcessor(ManifestStore(tmp_path), Empty).process(REQ)
    assert data.availability == 'no_coverage' and data.search_complete and not data.frames
    class Incomplete(Empty):
        def discover(self, req):
            return [], False, ['One collection unavailable']
    data = IRSAProcessor(ManifestStore(tmp_path/'other'), Incomplete).process(REQ)
    assert data.availability == 'search_incomplete'


def test_job_deduplication_queue_bound_and_restart(tmp_path):
    gate = threading.Event()
    class Processor:
        def process(self, req, progress):
            gate.wait(timeout=3)
            raise ArchiveUnavailable('test archive outage')
    store = ManifestStore(tmp_path)
    manager = JobManager(store, Processor())
    try:
        first = manager.submit(REQ)
        assert manager.submit(REQ).job_id == first.job_id
        for i in range(1, 6):
            manager.submit(REQ.model_copy(update={'ra': 30+i}))
        with pytest.raises(QueueFull):
            manager.submit(REQ.model_copy(update={'ra': 50}))
    finally:
        gate.set()
        manager.close()
    assert manager.get(first.job_id).error_code == 'archive_unavailable'


def test_real_api_frame_source_and_server_enforced_difference(tmp_path, monkeypatch):
    store = ManifestStore(tmp_path)
    data = IRSAProcessor(store, FakeArchive).process(REQ)
    monkeypatch.setattr(main, 'store', store)
    monkeypatch.setattr(main, 'source', 'irsa')
    manager = JobManager(store, IRSAProcessor(store, FakeArchive))
    monkeypatch.setattr(main, 'jobs', manager)
    client = TestClient(main.app)
    assert client.get('/health').json()['real_data_enabled'] is True
    assert client.get('/health').json()['scientific_subtraction_enabled'] is False
    frame = data.frames[0]
    response = client.get(frame.image_url)
    assert response.status_code == 200 and response.headers['x-data-source'] == 'spherex-irsa'
    assert client.get(f'/api/frames/{frame.id}/science.npz').status_code == 200
    original = client.get(f'/api/frames/{frame.id}/original.fits')
    assert original.status_code == 200 and original.content == fits_fixture()
    assert client.get(f'/api/observation-sets/{data.dataset_id}/manifest.json').status_code == 200
    assert client.get('/api/difference', params={'frame_a': frame.id, 'frame_b': frame.id}).status_code in (404, 422)
    assert client.post('/api/observation-jobs', json={**REQ.model_dump(), 'fov_arcmin': 60}).status_code == 422
    assert client.get('/api/observations', params={**REQ.model_dump(), 'ra': 31}).status_code == 409
    job = client.post('/api/observation-jobs', json=REQ.model_dump()).json()
    assert job['cache_hit'] and job['status'] == 'ready'
    assert client.get(f"/api/jobs/{job['job_id']}").json()['status'] == 'ready'
    manager.close()


def test_all_five_featured_fields_are_cached_genuine_observations(tmp_path):
    from app.irsa import SEEDS
    store = ManifestStore(tmp_path)
    presets = json.loads((Path(__file__).parents[1]/'app'/'presets.json').read_text())
    for preset in presets:
        req = FieldRequest(ra=preset['ra'], dec=preset['dec'], fov_arcmin=12, detector='D3')
        data = store.cached(req)
        assert data is not None and data.source_type == 'spherex-irsa'
        assert len(data.frames) >= 2
        for frame in data.frames:
            assert store.frame_path(frame.id).is_file()
            assert (SEEDS/data.dataset_id/'original'/f'{frame.sha256}.fits').is_file()
        assert all(not pair.difference_allowed for pair in data.pairs)
