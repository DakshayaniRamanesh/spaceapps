from fastapi.testclient import TestClient
from PIL import Image
import io

from app import main

client = TestClient(main.app)


def test_difference_preview_rejects_invalid_combinations():
    # Mixed sources
    res = client.get('/api/difference-preview?frame_a=syn-01&frame_b=irsa-000000000000000000000001-00')
    assert res.status_code == 422
    assert 'Difference preview requires real SPHEREx observation frames' in res.json()['detail']

    # Both synthetic
    res = client.get('/api/difference-preview?frame_a=syn-01&frame_b=syn-02')
    assert res.status_code == 422

    # Same frame
    res = client.get('/api/difference-preview?frame_a=irsa-000000000000000000000001-00&frame_b=irsa-000000000000000000000001-00')
    assert res.status_code == 422
    assert 'Select two distinct frames to compare' in res.json()['detail']

    # Different datasets
    res = client.get('/api/difference-preview?frame_a=irsa-000000000000000000000001-00&frame_b=irsa-000000000000000000000002-00')
    assert res.status_code == 422
    assert 'Frames must belong to the same observation dataset' in res.json()['detail']


def test_difference_preview_on_featured_real_data(monkeypatch):
    monkeypatch.setattr(main, 'source', 'irsa')
    # Load featured observations (R Draconis, D3, 12 arcmin)
    res = client.get('/api/observations?ra=248.16761083&dec=66.75497942&fov_arcmin=12&detector=D3')
    assert res.status_code == 200
    data = res.json()
    assert data['source_type'] == 'spherex-irsa'
    assert len(data['frames']) >= 2

    fa = data['frames'][0]['id']
    fb = data['frames'][1]['id']

    # Verify /api/difference remains restricted (scientific subtraction disabled)
    res_diff = client.get(f'/api/difference?frame_a={fa}&frame_b={fb}')
    assert res_diff.status_code == 422

    # Verify /api/difference-preview returns experimental visual difference PNG
    res_preview = client.get(f'/api/difference-preview?frame_a={fa}&frame_b={fb}')
    assert res_preview.status_code == 200
    assert res_preview.headers['Content-Type'] == 'image/png'
    assert res_preview.headers['X-Difference-Status'] == 'experimental-preview'
    assert res_preview.headers['X-Difference-Sign'] == 'B-minus-A'
    assert res_preview.headers['X-Data-Source'] == 'spherex-irsa'

    # Check valid PNG format and dimensions
    img = Image.open(io.BytesIO(res_preview.content))
    assert img.format == 'PNG'
    assert img.size == (data['width'], data['height'])

    # Test with mask overlay
    res_mask = client.get(f'/api/difference-preview?frame_a={fa}&frame_b={fb}&overlay=mask')
    assert res_mask.status_code == 200
    img_mask = Image.open(io.BytesIO(res_mask.content))
    assert img_mask.format == 'PNG'
    assert img_mask.size == (data['width'], data['height'])
