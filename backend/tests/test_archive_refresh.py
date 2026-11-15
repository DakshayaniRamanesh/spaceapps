import threading

import pytest
from fastapi.testclient import TestClient

from app import main
from app.archive.bounded import ArchiveUnavailable
from app.irsa import IRSAProcessor, ManifestStore
from app.jobs import JobManager
from test_real_data import FakeArchive, REQ


def test_refresh_bypasses_seed_and_runtime_cache_and_preserves_cache_on_failure(tmp_path):
    seeds = ManifestStore(tmp_path / 'seeds', seeds=tmp_path / 'none')
    original = IRSAProcessor(seeds, FakeArchive).process(REQ)
    store = ManifestStore(tmp_path / 'runtime', seeds=seeds.root)

    class Offline(FakeArchive):
        def discover(self, req):
            raise ArchiveUnavailable('IRSA offline')

    processor = IRSAProcessor(store, Offline)
    assert processor.process(REQ).dataset_id == original.dataset_id
    with pytest.raises(ArchiveUnavailable):
        processor.process(REQ, refresh=True)
    assert store.cached(REQ).dataset_id == original.dataset_id

    class Empty(FakeArchive):
        records = []

    refreshed = IRSAProcessor(store, Empty).process(REQ, refresh=True)
    assert refreshed.search_complete and not refreshed.frames
    assert refreshed.dataset_id != original.dataset_id
    # A newly queried result must take precedence over an immutable seed.
    assert store.cached(REQ).dataset_id == refreshed.dataset_id
    with pytest.raises(ArchiveUnavailable):
        processor.process(REQ, refresh=True)
    assert store.cached(REQ).dataset_id == refreshed.dataset_id


def test_refresh_job_is_persisted_deduplicated_and_rate_limited(tmp_path, monkeypatch):
    store = ManifestStore(tmp_path)
    original = IRSAProcessor(store, FakeArchive).process(REQ)
    entered, release = threading.Event(), threading.Event()
    calls = []

    class Processor:
        def process(self, request, progress, *, refresh=False):
            calls.append(refresh)
            entered.set()
            release.wait(5)
            raise ArchiveUnavailable('IRSA offline')

    manager = JobManager(store, Processor())
    monkeypatch.setattr(main, 'source', 'irsa')
    monkeypatch.setattr(main, 'store', store)
    monkeypatch.setattr(main, 'jobs', manager)
    admissions = []
    monkeypatch.setattr(main, 'admit_client', lambda request: admissions.append(True))
    client = TestClient(main.app)
    try:
        cached = client.post('/api/observation-jobs', json=REQ.model_dump()).json()
        assert cached['cache_hit'] and not admissions
        response = client.post('/api/observation-jobs?refresh=true', json=REQ.model_dump())
        assert response.status_code == 202
        job = response.json()
        assert job['refresh'] and not job['cache_hit']
        assert entered.wait(3)
        duplicate = client.post('/api/observation-jobs?refresh=true', json=REQ.model_dump()).json()
        assert duplicate['job_id'] == job['job_id']
        assert manager.get(job['job_id']).refresh
        assert len(admissions) == 2
    finally:
        release.set()
        manager.close()
    assert calls == [True]
    assert manager.get(job['job_id']).status == 'failed'
    assert store.cached(REQ).dataset_id == original.dataset_id
