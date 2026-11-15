"""Single-host bounded worker, persistent job states, duplicate suppression."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
import logging
import sqlite3
import threading
import time
import uuid

from .archive.bounded import ArchiveUnavailable, BudgetExceeded
from .irsa import request_key
from .models import FieldRequest, Job

LOG = logging.getLogger(__name__)


class QueueFull(RuntimeError):
    pass


class JobManager:
    def __init__(self, store, processor):
        self.store, self.processor = store, processor
        self.path = store.root / 'jobs.sqlite3'
        self.lock = threading.Lock()
        self.pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix='irsa')
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, field_key TEXT, created REAL, payload TEXT)')
            for job_id, payload in db.execute('SELECT id,payload FROM jobs').fetchall():
                job = Job.model_validate_json(payload)
                if job.status in ('queued', 'running'):
                    job.status, job.stage = 'failed', 'Interrupted by service restart'
                    job.error_code, job.message = 'service_restarted', 'Retry this request; the worker restarted.'
                    db.execute('UPDATE jobs SET payload=? WHERE id=?', (job.model_dump_json(), job_id))
            db.execute('DELETE FROM jobs WHERE created < ?', (time.time()-7*86400,))

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        try:
            with db:
                yield db
        finally:
            db.close()

    def get(self, job_id):
        with self.connect() as db:
            row = db.execute('SELECT payload FROM jobs WHERE id=?', (job_id,)).fetchone()
        if row is None:
            raise ValueError('Unknown job identifier')
        return Job.model_validate_json(row[0])

    def save(self, job):
        with self.connect() as db:
            db.execute('UPDATE jobs SET payload=? WHERE id=?', (job.model_dump_json(), job.job_id))

    def submit(self, req: FieldRequest):
        with self.lock:
            cached = self.store.cached(req)
            if cached:
                return Job(job_id=cached.dataset_id, status='ready', stage='Cached real observations', request=req,
                           dataset_id=cached.dataset_id, result_url=f'/api/observation-sets/{cached.dataset_id}', cache_hit=True)
            with self.connect() as db:
                active = []
                for payload, in db.execute('SELECT payload FROM jobs ORDER BY created DESC LIMIT 100'):
                    job = Job.model_validate_json(payload)
                    if job.status in ('queued', 'running'):
                        active.append(job)
                        if request_key(job.request) == request_key(req):
                            return job
                if len(active) >= 6:
                    raise QueueFull('The archive worker is busy. Retry shortly.')
                job = Job(job_id=uuid.uuid4().hex, status='queued', stage='Queued for archive worker', request=req)
                db.execute('INSERT INTO jobs VALUES (?,?,?,?)',
                           (job.job_id, request_key(req), time.time(), job.model_dump_json()))
            self.pool.submit(self.run, job.job_id)
            return job

    def run(self, job_id):
        job = self.get(job_id)
        job.status, job.stage = 'running', 'Searching NASA archive'
        self.save(job)
        def progress(stage):
            job.stage = stage
            self.save(job)
        try:
            data = self.processor.process(job.request, progress)
            job.status, job.stage = 'ready', 'Real-data result prepared'
            job.dataset_id = data.dataset_id
            job.result_url = f'/api/observation-sets/{data.dataset_id}'
        except (ArchiveUnavailable, BudgetExceeded) as exc:
            job.status, job.stage = 'failed', 'Archive request could not complete'
            job.error_code, job.message = 'archive_unavailable', str(exc)
        except Exception:
            LOG.exception('Processing job failed: %s', job_id)
            job.status, job.stage = 'failed', 'Processing failed'
            job.error_code = 'processing_failed'
            job.message = 'The FITS data could not be processed safely. Retry or choose another field.'
        self.save(job)

    def close(self):
        self.pool.shutdown(wait=True, cancel_futures=True)
