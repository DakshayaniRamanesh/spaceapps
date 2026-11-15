"""SkyTrace API: real data by default; synthetic observations require opt-in."""
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from functools import lru_cache
import json
import os
from pathlib import Path
import threading
import time

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from .models import FieldRequest, Detector, ObservationSet, Job
from .providers import SyntheticObservationProvider, decode_frame, render_frame, render_difference, difference_arrays
from .irsa import IRSAProcessor, ManifestStore
from .jobs import JobManager, QueueFull
from .catalogues import Catalogue, Overlay, CatalogueService, CatalogueUnavailable, OverlayUnavailable
from pydantic import ValidationError
from PIL import Image
import io
import numpy as np

catalogues = CatalogueService()

source = os.getenv('OBSERVATION_SOURCE', 'irsa')
if source not in ('synthetic', 'irsa'):
    raise RuntimeError('OBSERVATION_SOURCE must be synthetic or irsa')
provider = SyntheticObservationProvider()
store = ManifestStore()
jobs = JobManager(store, IRSAProcessor(store))


@asynccontextmanager
async def lifespan(app):
    yield
    jobs.close()


app = FastAPI(title='SkyTrace Observation API', version='2.1.0', lifespan=lifespan,
              description='Real SPHEREx FITS previews, traceable metadata and explicit comparison permissions.')
app.add_middleware(CORSMiddleware, allow_origins=os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(','),
                   allow_methods=['GET', 'POST'], allow_headers=['Content-Type'])
_requests = defaultdict(deque)
_rate_lock = threading.Lock()


def admit_client(request):
    client = request.client.host if request.client else 'unknown'
    with _rate_lock:
        now = time.monotonic()
        for key in list(_requests):
            while _requests[key] and now-_requests[key][0] >= 60:
                _requests[key].popleft()
            if not _requests[key]:
                del _requests[key]
        if (client not in _requests and len(_requests) >= 4096) or len(_requests[client]) >= 12:
            raise HTTPException(429, 'Please wait before starting more archive searches.', headers={'Retry-After': '60'})
        _requests[client].append(now)


@app.middleware('http')
async def response_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response


@app.get('/health')
def health():
    return {'status': 'ok', 'source': 'synthetic' if source == 'synthetic' else 'spherex-irsa',
            'real_data_enabled': source == 'irsa', 'scientific_subtraction_enabled': False,
            'schema_version': 2, 'max_fov_arcmin': 30 if source == 'irsa' else 60}


@app.get('/api/presets')
def presets():
    return json.loads((Path(__file__).parent/'presets.json').read_text())


@app.post('/api/observation-jobs', response_model=Job)
def submit_job(req: FieldRequest, response: Response, request: Request):
    if source != 'irsa':
        raise HTTPException(409, 'Archive jobs require OBSERVATION_SOURCE=irsa')
    if req.fov_arcmin > 30:
        raise HTTPException(422, 'Real-data requests support fields from 2 to 30 arcminutes.')
    try:
        if store.cached(req) is None:
            admit_client(request)
        job = jobs.submit(req)
        response.status_code = 200 if job.status == 'ready' else 202
        response.headers['Cache-Control'] = 'no-store'
        return job
    except QueueFull as exc:
        raise HTTPException(429, str(exc), headers={'Retry-After': '30'})


@app.get('/api/jobs/{job_id}', response_model=Job)
def job_status(job_id: str, response: Response):
    response.headers['Cache-Control'] = 'no-store'
    try:
        if job_id.startswith('irsa-'):
            data = store.load(job_id)
            return Job(job_id=job_id, status='ready', stage='Cached real observations', request=data.request,
                       dataset_id=data.dataset_id, result_url=f'/api/observation-sets/{data.dataset_id}', cache_hit=True)
        return jobs.get(job_id)
    except ValueError as exc:
        raise HTTPException(404, str(exc))


@app.get('/api/observations', response_model=ObservationSet)
def observations(ra: float = Query(ge=0, lt=360, allow_inf_nan=False),
                 dec: float = Query(ge=-90, le=90, allow_inf_nan=False),
                 fov_arcmin: float = Query(12, ge=2, le=60, allow_inf_nan=False), detector: Detector = 'D1',
                 limit: int = Query(12, ge=2, le=50), spread: bool = False,
                 start_date: str | None = None, end_date: str | None = None,
                 min_wavelength_um: float | None = Query(None, gt=0, allow_inf_nan=False),
                 max_wavelength_um: float | None = Query(None, gt=0, allow_inf_nan=False)):
    try:
        req = FieldRequest(ra=ra, dec=dec, fov_arcmin=fov_arcmin, detector=detector,
                           limit=limit, spread=spread, start_date=start_date, end_date=end_date,
                           min_wavelength_um=min_wavelength_um, max_wavelength_um=max_wavelength_um)
    except ValidationError as exc:
        raise HTTPException(422, str(exc))
    if source == 'synthetic':
        if isinstance(provider, SyntheticObservationProvider) and (min_wavelength_um is not None or max_wavelength_um is not None):
            raise HTTPException(422, 'Wavelength filtering requires real SPHEREx WCS-WAVE data')
        return provider.observations(req, limit=limit, spread=spread, start_mjd=req.start_mjd,
                                     end_mjd=np.nextafter(req.end_mjd, -np.inf) if req.end_mjd is not None else None)
    if fov_arcmin > 30:
        raise HTTPException(422, 'Real-data requests support fields from 2 to 30 arcminutes.')
    data = store.cached(req)
    if data:
        return data
    raise HTTPException(409, 'This field is not prepared. Start POST /api/observation-jobs.')


@app.get('/api/observation-sets/{dataset_id}', response_model=ObservationSet)
def observation_set(dataset_id: str):
    try:
        return store.load(dataset_id)
    except ValueError as exc:
        raise HTTPException(404, str(exc))


@app.get('/api/observation-sets/{dataset_id}/manifest.json')
def manifest(dataset_id: str):
    try:
        data = store.load(dataset_id)
        return JSONResponse(data.model_dump(), headers={'Content-Disposition': f'attachment; filename="{dataset_id}.json"'})
    except ValueError as exc:
        raise HTTPException(404, str(exc))


@app.get('/api/observation-sets/{dataset_id}/catalogues/{catalogue}', response_model=Overlay)
def catalogue_overlay(dataset_id: str, catalogue: Catalogue, response: Response,
                      limit: int = Query(500, ge=1, le=1000)):
    try:
        data = store.load(dataset_id)
    except ValueError as exc:
        raise HTTPException(404, str(exc))
    response.headers['Cache-Control'] = 'no-store'
    try:
        return catalogues.overlay(data, catalogue, limit)
    except OverlayUnavailable as exc:
        raise HTTPException(409, str(exc))
    except CatalogueUnavailable as exc:
        raise HTTPException(503, str(exc), headers={'Retry-After': '30'})


@lru_cache(maxsize=128)
def frame_bytes(frame_id: str):
    return render_frame(provider.array(frame_id))


@lru_cache(maxsize=64)
def masked_frame(frame_id):
    # Reuse the exact preview RGBA and its display mask. No new photometric stretch.
    with np.load(store.frame_path(frame_id, 'npz'), allow_pickle=False) as science:
        bad = np.flipud(science['mask'])
    rgba = np.array(Image.open(store.frame_path(frame_id)).convert('RGBA'))
    rgba[bad] = [245, 199, 125, 150]
    buffer = io.BytesIO()
    Image.fromarray(rgba).save(buffer, format='PNG')
    return buffer.getvalue()


@app.get('/api/frames/{frame_id}.png')
def frame(frame_id: str, overlay: str | None = Query(None, pattern='^mask$')):
    try:
        if frame_id.startswith('irsa-'):
            if overlay == 'mask':
                return Response(masked_frame(frame_id), media_type='image/png',
                                headers={'X-Data-Source': 'spherex-irsa', 'X-Quality-Overlay': 'mask'})
            return FileResponse(store.frame_path(frame_id), media_type='image/png',
                                headers={'Cache-Control': 'public, max-age=86400', 'X-Data-Source': 'spherex-irsa'})
        if source != 'synthetic':
            raise ValueError('Unknown frame identifier')
        return Response(frame_bytes(frame_id), media_type='image/png',
                        headers={'Cache-Control': 'public, max-age=86400', 'X-Data-Source': 'synthetic'})
    except ValueError as exc:
        raise HTTPException(404, str(exc))


@app.get('/api/frames/{frame_id}/science.npz')
def science_arrays(frame_id: str):
    try:
        return FileResponse(store.frame_path(frame_id, 'npz'), media_type='application/octet-stream', filename=f'{frame_id}.npz')
    except ValueError as exc:
        raise HTTPException(404, str(exc))


@app.get('/api/frames/{frame_id}/original.fits')
def original_cutout(frame_id: str):
    try:
        return FileResponse(store.original_path(frame_id), media_type='application/fits',
                            filename=f'{frame_id}-original.fits', headers={'X-Data-Source': 'spherex-irsa'})
    except ValueError as exc:
        raise HTTPException(404, str(exc))


@lru_cache(maxsize=64)
def difference_bytes(frame_a: str, frame_b: str):
    return render_difference(difference_arrays(provider.array(frame_a), provider.array(frame_b)))


@app.get('/api/difference')
def difference(frame_a: str = Query(max_length=240), frame_b: str = Query(max_length=240)):
    try:
        if frame_a.startswith('irsa-') or frame_b.startswith('irsa-'):
            if not (frame_a.startswith('irsa-') and frame_b.startswith('irsa-')):
                raise HTTPException(422, 'Mixed-source comparisons are not permitted.')
            pair = store.pair(frame_a, frame_b)
            if not pair.difference_allowed or any(c.status != 'pass' for c in pair.checks):
                raise HTTPException(422, pair.reason)
            raise HTTPException(422, 'Scientific subtraction is not enabled in this preview release.')
        if source != 'synthetic':
            raise ValueError('Unknown frame identifier')
        a, _ = decode_frame(frame_a)
        b, _ = decode_frame(frame_b)
        if a != b:
            raise HTTPException(422, 'Compare frames from the same registered field and detector.')
        return Response(difference_bytes(frame_a, frame_b), media_type='image/png',
                        headers={'Cache-Control': 'public, max-age=86400', 'X-Data-Source': 'synthetic', 'X-Difference-Sign': 'B-minus-A'})
    except ValueError as exc:
        raise HTTPException(404, str(exc))
