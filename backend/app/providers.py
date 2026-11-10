"""Scientific providers. Float arrays remain separate from display stretches."""
from abc import ABC, abstractmethod
from functools import lru_cache
import base64
import hashlib
import io
import json
from datetime import datetime, timedelta, timezone
import numpy as np
from PIL import Image
from .models import FieldRequest, Frame, ObservationSet

SIZE = 384
FRAME_COUNT = 8
RANGES = [(0.75, 1.09), (1.10, 1.62), (1.63, 2.41), (2.42, 3.82), (3.83, 4.41), (4.42, 5.00)]

def canonical(req: FieldRequest) -> FieldRequest:
    # Preserve validated boundary values (e.g. RA just below 360).
    return FieldRequest(ra=min(round(req.ra, 6), 359.999999), dec=round(req.dec, 6), fov_arcmin=round(req.fov_arcmin, 4), detector=req.detector)

def field_key(req: FieldRequest) -> str:
    return base64.urlsafe_b64encode(json.dumps(canonical(req).model_dump(), sort_keys=True, separators=(',', ':')).encode()).decode().rstrip('=')

def decode_frame(frame_id: str) -> tuple[FieldRequest, int]:
    try:
        if len(frame_id) > 240:
            raise ValueError('ID too long')
        key, index = frame_id.rsplit('.', 1)
        i = int(index)
        if i < 0 or i >= FRAME_COUNT:
            raise ValueError('Invalid frame')
        req = FieldRequest.model_validate_json(base64.urlsafe_b64decode(key + '=' * (-len(key) % 4)))
        if field_key(req) != key:
            raise ValueError('Noncanonical ID')
        return req, i
    except Exception as exc:
        raise ValueError('Unknown frame identifier') from exc

def seed_for(value: str) -> int:
    return int.from_bytes(hashlib.sha256(value.encode()).digest()[:8], 'little')

def add_source(image: np.ndarray, x: float, y: float, flux: float, sigma: float):
    radius = int(np.ceil(5 * sigma))
    x0, x1 = max(0, int(x)-radius), min(SIZE, int(x)+radius+1)
    y0, y1 = max(0, int(y)-radius), min(SIZE, int(y)+radius+1)
    if x0 >= x1 or y0 >= y1:
        return
    yy, xx = np.mgrid[y0:y1, x0:x1]
    image[y0:y1, x0:x1] += flux * np.exp(-((xx-x)**2+(yy-y)**2)/(2*sigma*sigma))

@lru_cache(maxsize=8)
def scene(key: str) -> tuple[np.ndarray, ...]:
    req, _ = decode_frame(key + '.0')
    # The catalogue is independent of FOV and detector: expanding the FOV
    # reveals more sources, while existing sources retain angular positions.
    rng = np.random.default_rng(seed_for(f'{req.ra:.6f}:{req.dec:.6f}:catalog-v1'))
    angular = rng.uniform(-31, 31, (2600, 2))
    angular = np.vstack([angular, rng.uniform(-1, 1, (14, 2))])
    fluxes = rng.lognormal(4.3, 1.0, len(angular))
    slopes = rng.uniform(-0.85, 0.85, len(angular))
    d = int(req.detector[1])-1
    response = np.exp(slopes * (d-2.5)/2)
    pixels = (angular/req.fov_arcmin + .5) * SIZE
    sigma = 1.15 + d * .12
    yy, xx = np.mgrid[:SIZE, :SIZE]
    base = (20 + 1.3*np.sin(xx/140) + .9*np.cos(yy/170)).astype(np.float32)
    for (x, y), flux in zip(pixels, fluxes * response):
        add_source(base, x, y, float(flux), sigma)
    frames = []
    for i in range(FRAME_COUNT):
        arr = base.copy()
        # Motion is deliberately exaggerated, with a constant angular path.
        mx = (-.48 + i*.14)/req.fov_arcmin*SIZE + SIZE/2
        my = (.3 - i*.075)/req.fov_arcmin*SIZE + SIZE/2
        add_source(arr, mx, my, 1150 * (1+d*.12), sigma*1.2)
        vx, vy = (.55/req.fov_arcmin+.5)*SIZE, (-.58/req.fov_arcmin+.5)*SIZE
        add_source(arr, vx, vy, (480+390*np.sin(i*2*np.pi/FRAME_COUNT))*(1+d*.08), sigma*1.2)
        noise_rng = np.random.default_rng(seed_for(f'{key}:{i}:noise-v1'))
        arr += noise_rng.normal(0, 2.5, arr.shape).astype(np.float32)
        arr.setflags(write=False)
        frames.append(arr)
    return tuple(frames)

def png(rgb: np.ndarray) -> bytes:
    buffer = io.BytesIO()
    Image.fromarray(rgb.astype(np.uint8)).save(buffer, format='PNG', optimize=True)
    return buffer.getvalue()

def render_frame(arr: np.ndarray) -> bytes:
    # Fixed stretch across every epoch and detector, preserving variability.
    v = np.clip(np.arcsinh(np.maximum(arr-15, 0)/12)/np.arcsinh(1500/12), 0, 1)
    rgb = np.stack([v*.88, v*.95, v], axis=-1)*255
    return png(rgb)

def difference_arrays(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    return b.astype(np.float32)-a.astype(np.float32)

def render_difference(diff: np.ndarray) -> bytes:
    # Negative: violet. Positive: amber. Zero: dark neutral.
    strength = np.clip(np.arcsinh(np.abs(diff)/8)/np.arcsinh(1000/8), 0, 1)[..., None]
    negative, positive, zero = np.array([147,135,245]), np.array([245,199,125]), np.array([8,14,24])
    color = np.where((diff >= 0)[..., None], positive, negative)
    return png(zero + strength * (color-zero))

class ObservationProvider(ABC):
    @abstractmethod
    def observations(self, request: FieldRequest) -> ObservationSet: ...
    @abstractmethod
    def array(self, frame_id: str) -> np.ndarray: ...

class SyntheticObservationProvider(ObservationProvider):
    def observations(self, request: FieldRequest) -> ObservationSet:
        request = canonical(request)
        key = field_key(request)
        scene(key)
        start = datetime(2025, 1, 15, 3, 24, tzinfo=timezone.utc)
        frames = [Frame(id=f'{key}.{i}', timestamp=(start+timedelta(days=90*i)).isoformat(), image_url=f'/api/frames/{key}.{i}.png', detector=request.detector) for i in range(FRAME_COUNT)]
        return ObservationSet(dataset_id='skytrace-synthetic-v1-'+hashlib.sha256(key.encode()).hexdigest()[:12], request=request, frames=frames, wavelength_range_um=RANGES[int(request.detector[1])-1])
    def array(self, frame_id: str) -> np.ndarray:
        req, i = decode_frame(frame_id)
        return scene(field_key(req))[i]

class SpherexIRSAProvider(ObservationProvider):
    """Disabled until calibrated FITS/WCS/LVF registration is implemented."""
    def observations(self, request: FieldRequest) -> ObservationSet:
        raise NotImplementedError('IRSA integration is not enabled. Use OBSERVATION_SOURCE=synthetic.')
    def array(self, frame_id: str) -> np.ndarray:
        raise NotImplementedError('IRSA integration is not enabled.')
