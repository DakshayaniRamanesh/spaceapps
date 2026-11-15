"""Deterministic catalogue fixtures only; live checks live in scripts/check_catalogues.py."""
import json
from pathlib import Path

import httpx
import numpy as np
import pytest
from astropy.coordinates import SkyCoord
from astropy import units as u
from fastapi.testclient import TestClient

from app import main
from app.catalogues import (CatalogueService, CatalogueUnavailable, OverlayUnavailable,
                            displayed_position, footprint, normalize, query_text, retrieve)
from app.irsa import ManifestStore
from app.models import ObservationSet


@pytest.fixture
def data():
    path = next((Path(__file__).parents[1]/'data'/'featured').glob('*/manifest.json'))
    return ObservationSet.model_validate_json(path.read_text())


def source(ra=0, dec=0, **extra):
    return normalize(dict(source_id='9007199254740993123', ra=str(ra), dec=str(dec),
                          ref_epoch='2016', pmra='', pmdec='', phot_g_mean_mag='', ruwe='', **extra), 'gaia')


def test_normalization_large_identifier_and_nulls():
    s = source()
    assert s.source_id == '9007199254740993123'
    assert s.pmra is None and s.pmdec is None
    assert s.magnitudes == {'Gaia G': None}
    assert json.loads(s.model_dump_json())['source_id'] == s.source_id
    wise = normalize(dict(designation='J000000.00+000000.0', ra='0', dec='0', w1mpro='NaN', w2mpro='0', ph_qual='', cc_flags='0000'), 'wise')
    assert wise.reference_epoch is None
    assert list(wise.magnitudes.values()) == [None, 0]
    assert wise.quality['ph_qual'] is None
    with pytest.raises(CatalogueUnavailable):
        normalize({'source_id': '1', 'ra': 'nan', 'dec': '0'}, 'gaia')


def test_motion_and_missing_astrometry():
    s = source()
    s.pmra, s.pmdec = 1000, -500
    coord, treatment = displayed_position(s, '2026-01-01T12:00:00Z', 'gaia')
    assert treatment == 'propagated_position'
    # Ten Julian years, 10 arcsec east and 5 arcsec south at dec=0.
    assert coord.ra.deg*3600 == pytest.approx(10, abs=.01)
    assert coord.dec.deg*3600 == pytest.approx(-5, abs=.01)
    s.pmdec = None
    coord, treatment = displayed_position(s, '2026-01-01', 'gaia')
    assert treatment == 'propagation_unavailable' and coord.ra.deg == 0
    assert displayed_position(s, '2026-01-01', 'wise')[1] == 'catalogue_position'


@pytest.mark.parametrize('ra,dec', [(359.999, 0), (.001, 89.8), (30, -89.8)])
def test_projection_corners_wrap_poles_and_png_orientation(data, ra, dec):
    # Asymmetric corner fixture catches flips, mirrors, pixel offsets and rectangular assumptions.
    data.grid.update(CRVAL1=ra, CRVAL2=dec, CRPIX1=31, CRPIX2=21)
    data.width, data.height = 60, 40
    w, center, radius = footprint(data)
    pixels = [(2, 3), (54, 31), (5, 35), (data.width-.6, 7), (-2, 4)]
    rows = []
    for i, (x, y) in enumerate(pixels):
        sky = w.pixel_to_world(x, y)
        rows.append(source(sky.ra.deg, sky.dec.deg))
        rows[-1].source_id = str(i)
        if i < 4:
            assert center.separation(sky).deg <= radius
    service = CatalogueService(fetch=lambda *args: (rows, False, '2026-01-01T00:00:00Z'))
    result = service.overlay(data, 'gaia')
    assert len(result.sources) == 4
    for s, (x, y) in zip(result.sources, pixels):
        p = s.positions[data.frames[0].id]
        assert p.x == pytest.approx(x, abs=1e-7)
        assert p.y == pytest.approx(data.height-1-y, abs=1e-7)
    assert result.query_radius_deg == pytest.approx(radius+120/3600)
    assert "CIRCLE('ICRS'," in query_text('gaia', center, radius, 10)


def test_cache_empty_failure_limits_and_frame_reprojection(data):
    now, calls = [0], []
    def fetch(*args):
        calls.append(args)
        return [], False, '2026-01-01'
    service = CatalogueService(fetch=fetch, clock=lambda: now[0])
    assert not service.overlay(data, 'gaia').sources
    service.overlay(data, 'gaia')
    assert len(calls) == 1
    data.frames[0].timestamp = '2026-02-01T00:00:00Z'
    service.overlay(data, 'gaia')
    assert len(calls) == 1  # Raw query is independent of frame dates.
    service.overlay(data, 'gaia', 10)
    assert len(calls) == 2
    now[0] = 61
    service.overlay(data, 'gaia')
    assert len(calls) == 3
    def failing(*args):
        calls.append(args)
        raise CatalogueUnavailable('Timeout')
    broken = CatalogueService(fetch=failing)
    for _ in range(2):
        with pytest.raises(CatalogueUnavailable):
            broken.overlay(data, 'wise')
    assert len(calls) == 5
    assert not broken.raw and not broken.projected
    for limit in (0, 1001, float('nan')):
        with pytest.raises(ValueError):
            service.overlay(data, 'gaia', limit)


def test_batched_motion_uses_frame_epochs_and_can_enter_field(data):
    data.grid.update(CRVAL1=0., CRVAL2=0., CRPIX1=11., CRPIX2=11., CDELT1=-.001, CDELT2=.001)
    data.width = data.height = 20
    data.frames = [data.frames[0].model_copy(deep=True), data.frames[-1].model_copy(deep=True)]
    data.frames[0].id, data.frames[1].id = 'first', 'last'
    data.frames[0].timestamp = '2016-01-01T12:00:00Z'
    data.frames[1].timestamp = '2026-01-01T12:00:00Z'
    s = source(.012, 0)
    s.pmra, s.pmdec = -2000, 0
    service = CatalogueService(fetch=lambda *args: ([s], False, '2026-01-01'))
    result = service.overlay(data, 'gaia')
    assert len(result.sources) == 1
    positions = result.sources[0].positions
    assert 'first' not in positions and 'last' in positions
    expected, _ = displayed_position(s, data.frames[1].timestamp, 'gaia')
    assert positions['last'].ra == pytest.approx(expected.ra.deg, abs=1e-10)
    assert positions['last'].treatment == 'propagated_position'
    assert not s.positions  # Cache originals are immutable across projected datasets.


def test_upstream_empty_truncation_timeout_and_format():
    header = 'source_id,ra,dec,ref_epoch,pmra,pmdec,phot_g_mean_mag,ruwe\n'
    def fetch(body, status=200, cap=1):
        client = httpx.Client(transport=httpx.MockTransport(lambda req: httpx.Response(status, text=body)))
        return retrieve('gaia', 'fixed query', cap, client=client)
    assert fetch(header)[0:2] == ([], False)
    rows, truncated, _ = fetch(header+'9007199254740993123,0,0,2016,,,10,1\n2,0,0,2016,,,11,1\n')
    assert truncated and len(rows) == 1 and rows[0].source_id == '9007199254740993123'
    for body, status in [('outage', 503), ('rate limit', 429), ('<xml>error</xml>', 200), ('', 302)]:
        with pytest.raises(CatalogueUnavailable):
            fetch(body, status)
    def timeout(req):
        raise httpx.ReadTimeout('timeout')
    with pytest.raises(CatalogueUnavailable):
        retrieve('gaia', 'query', 1, httpx.Client(transport=httpx.MockTransport(timeout)))


def test_unsupported_manifests_and_api_validation(data, monkeypatch):
    client = TestClient(main.app)
    monkeypatch.setattr(main.store, 'load', lambda _: data)
    for path in ('bad', 'gaia?limit=0', 'gaia?limit=1001', 'gaia?limit=nan'):
        assert client.get('/api/observation-sets/test/catalogues/'+path).status_code == 422
    for update in ({'grid': {}}, {'source_type': 'synthetic'}, {'frames': []}):
        old = data.model_copy(update=update)
        with pytest.raises(OverlayUnavailable):
            footprint(old)
        monkeypatch.setattr(main.store, 'load', lambda _, old=old: old)
        assert client.get('/api/observation-sets/test/catalogues/gaia').status_code == 409
    monkeypatch.setattr(main.store, 'load', lambda _: data)
    def fail(*args):
        raise CatalogueUnavailable('retry later')
    monkeypatch.setattr(main.catalogues, 'overlay', fail)
    response = client.get('/api/observation-sets/test/catalogues/gaia')
    assert response.status_code == 503 and response.headers['Retry-After'] == '30'
    def missing(_):
        raise ValueError('missing')
    monkeypatch.setattr(main.store, 'load', missing)
    assert client.get('/api/observation-sets/test/catalogues/wise').status_code == 404


def test_dataset_endpoint_success_contract_and_cache(data, monkeypatch):
    calls = []
    w, center, _ = footprint(data)
    row = source(center.ra.deg, center.dec.deg)
    def fetch(*args):
        calls.append(args)
        return [row], True, '2026-01-01T00:00:00Z'
    monkeypatch.setattr(main, 'catalogues', CatalogueService(fetch=fetch))
    monkeypatch.setattr(main.store, 'load', lambda _: data)
    client = TestClient(main.app)
    for _ in range(2):
        response = client.get(f'/api/observation-sets/{data.dataset_id}/catalogues/gaia?limit=10')
        assert response.status_code == 200
        body = response.json()
        assert body['sources'][0]['source_id'] == '9007199254740993123'
        assert body['sources'][0]['pmra'] is None
        assert set(body['sources'][0]['positions']) == {f.id for f in data.frames}
        assert body['truncated'] and body['result_limit'] == 10
        assert response.headers['Cache-Control'] == 'no-store'
    assert len(calls) == 1
