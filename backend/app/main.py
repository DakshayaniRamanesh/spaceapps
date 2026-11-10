import json
import os
from pathlib import Path
from functools import lru_cache
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from .models import FieldRequest, Detector, ObservationSet
from .providers import SyntheticObservationProvider, SpherexIRSAProvider, decode_frame, render_frame, render_difference, difference_arrays

app = FastAPI(title='SkyTrace Observation API', version='1.0.0', description='Clearly labeled synthetic astronomical observations; not SPHEREx measurements.')
app.add_middleware(CORSMiddleware, allow_origins=os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(','), allow_methods=['GET'], allow_headers=['*'])
source = os.getenv('OBSERVATION_SOURCE', 'synthetic')
if source not in ('synthetic', 'irsa'):
    raise RuntimeError('OBSERVATION_SOURCE must be synthetic or irsa')
provider = SyntheticObservationProvider() if source == 'synthetic' else SpherexIRSAProvider()

@app.get('/health')
def health():
    return {'status': 'ok' if source == 'synthetic' else 'unavailable', 'source': source, 'real_data_enabled': False}

@app.get('/api/presets')
def presets():
    return json.loads((Path(__file__).parent/'presets.json').read_text())

@app.get('/api/observations', response_model=ObservationSet)
def observations(ra: float = Query(ge=0, lt=360, allow_inf_nan=False), dec: float = Query(ge=-90, le=90, allow_inf_nan=False), fov_arcmin: float = Query(12, ge=2, le=60, allow_inf_nan=False), detector: Detector = 'D1'):
    try:
        return provider.observations(FieldRequest(ra=ra, dec=dec, fov_arcmin=fov_arcmin, detector=detector))
    except NotImplementedError as exc:
        raise HTTPException(503, str(exc))

@lru_cache(maxsize=128)
def frame_bytes(frame_id: str):
    return render_frame(provider.array(frame_id))

@app.get('/api/frames/{frame_id}.png', responses={200: {'content': {'image/png': {}}}})
def frame(frame_id: str):
    try:
        return Response(frame_bytes(frame_id), media_type='image/png', headers={'Cache-Control': 'public, max-age=86400', 'X-Data-Source': 'synthetic'})
    except ValueError as exc:
        raise HTTPException(404, str(exc))
    except NotImplementedError as exc:
        raise HTTPException(503, str(exc))

@lru_cache(maxsize=64)
def difference_bytes(frame_a: str, frame_b: str):
    return render_difference(difference_arrays(provider.array(frame_a), provider.array(frame_b)))

@app.get('/api/difference', responses={200: {'content': {'image/png': {}}}})
def difference(frame_a: str = Query(max_length=240), frame_b: str = Query(max_length=240)):
    try:
        a, _ = decode_frame(frame_a)
        b, _ = decode_frame(frame_b)
        if a != b:
            raise HTTPException(422, 'Compare frames from the same registered field and detector.')
        return Response(difference_bytes(frame_a, frame_b), media_type='image/png', headers={'Cache-Control': 'public, max-age=86400', 'X-Data-Source': 'synthetic', 'X-Difference-Sign': 'B-minus-A'})
    except ValueError as exc:
        raise HTTPException(404, str(exc))
    except NotImplementedError as exc:
        raise HTTPException(503, str(exc))
