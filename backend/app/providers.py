"""Scientific observation providers for synthetic simulations and genuine SPHEREx DR1+QR3 archival data."""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
import base64
import hashlib
import io
import json
import logging
import os

import numpy as np
from PIL import Image
from astropy.coordinates import SkyCoord

from .models import FieldRequest, Frame, ObservationSet, Quality
from .archive.irsa_client import IrsaSpherexClient
from .science.fits_loader import parse_spherex_mef
from .science.registration import reproject_to_grid
from .science.difference import render_science_frame, render_difference_frame, compute_difference
from .services.cache import (
    ARRAY_CACHE,
    SCIENCE_CACHE,
    MANIFEST_CACHE,
    register_frame_record,
    get_frame_record,
)

logger = logging.getLogger(__name__)

SIZE = 384
FRAME_COUNT = 8
RANGES = [
    (0.75, 1.09),
    (1.10, 1.62),
    (1.63, 2.41),
    (2.42, 3.82),
    (3.83, 4.41),
    (4.42, 5.00),
]


def canonical(req: FieldRequest) -> FieldRequest:
    """Preserve validated boundary values (e.g. RA just below 360)."""
    return FieldRequest(
        ra=min(round(req.ra, 6), 359.999999),
        dec=round(req.dec, 6),
        fov_arcmin=round(req.fov_arcmin, 4),
        detector=req.detector,
    )


def field_key(req: FieldRequest) -> str:
    return base64.urlsafe_b64encode(
        json.dumps(canonical(req).model_dump(), sort_keys=True, separators=(',', ':')).encode()
    ).decode().rstrip('=')


def decode_frame(frame_id: str) -> tuple[FieldRequest, int]:
    """Decode a deterministic synthetic frame ID."""
    try:
        if len(frame_id) > 240:
            raise ValueError('ID too long')
        key, index = frame_id.rsplit('.', 1)
        i = int(index)
        if i < 0 or i >= FRAME_COUNT:
            raise ValueError('Invalid frame index')
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
    x0, x1 = max(0, int(x) - radius), min(SIZE, int(x) + radius + 1)
    y0, y1 = max(0, int(y) - radius), min(SIZE, int(y) + radius + 1)
    if x0 >= x1 or y0 >= y1:
        return
    yy, xx = np.mgrid[y0:y1, x0:x1]
    image[y0:y1, x0:x1] += flux * np.exp(-((xx - x)**2 + (yy - y)**2) / (2 * sigma * sigma))


@lru_cache(maxsize=8)
def scene(key: str) -> tuple[np.ndarray, ...]:
    req, _ = decode_frame(key + '.0')
    rng = np.random.default_rng(seed_for(f'{req.ra:.6f}:{req.dec:.6f}:catalog-v1'))
    angular = rng.uniform(-31, 31, (2600, 2))
    angular = np.vstack([angular, rng.uniform(-1, 1, (14, 2))])
    fluxes = rng.lognormal(4.3, 1.0, len(angular))
    slopes = rng.uniform(-0.85, 0.85, len(angular))
    d = int(req.detector[1]) - 1
    response = np.exp(slopes * (d - 2.5) / 2)
    pixels = (angular / req.fov_arcmin + .5) * SIZE
    sigma = 1.15 + d * .12
    yy, xx = np.mgrid[:SIZE, :SIZE]
    base = (20 + 1.3 * np.sin(xx / 140) + .9 * np.cos(yy / 170)).astype(np.float32)
    for (x, y), flux in zip(pixels, fluxes * response):
        add_source(base, x, y, float(flux), sigma)
    frames = []
    for i in range(FRAME_COUNT):
        arr = base.copy()
        mx = (-.48 + i * .14) / req.fov_arcmin * SIZE + SIZE / 2
        my = (.3 - i * .075) / req.fov_arcmin * SIZE + SIZE / 2
        add_source(arr, mx, my, 1150 * (1 + d * .12), sigma * 1.2)
        vx, vy = (.55 / req.fov_arcmin + .5) * SIZE, (-.58 / req.fov_arcmin + .5) * SIZE
        add_source(arr, vx, vy, (480 + 390 * np.sin(i * 2 * np.pi / FRAME_COUNT)) * (1 + d * .08), sigma * 1.2)
        noise_rng = np.random.default_rng(seed_for(f'{key}:{i}:noise-v1'))
        arr += noise_rng.normal(0, 2.5, arr.shape).astype(np.float32)
        arr.setflags(write=False)
        frames.append(arr)
    return tuple(frames)


def png(rgb: np.ndarray) -> bytes:
    buffer = io.BytesIO()
    Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).save(buffer, format='PNG', optimize=True)
    return buffer.getvalue()


def render_frame(arr: np.ndarray) -> bytes:
    """Fixed stretch across every epoch and detector for synthetic arrays."""
    v = np.clip(np.arcsinh(np.maximum(arr - 15, 0) / 12) / np.arcsinh(1500 / 12), 0, 1)
    rgb = np.stack([v * .88, v * .95, v], axis=-1) * 255
    return png(rgb)


def difference_arrays(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    return b.astype(np.float32) - a.astype(np.float32)


def render_difference(diff: np.ndarray) -> bytes:
    """Negative: violet. Positive: amber. Zero: dark neutral."""
    strength = np.clip(np.arcsinh(np.abs(diff) / 8) / np.arcsinh(1000 / 8), 0, 1)[..., None]
    negative, positive, zero = np.array([147, 135, 245]), np.array([245, 199, 125]), np.array([8, 14, 24])
    color = np.where((diff >= 0)[..., None], positive, negative)
    return png(zero + strength * (color - zero))


class ObservationProvider(ABC):
    @abstractmethod
    def observations(self, request: FieldRequest) -> ObservationSet: ...
    @abstractmethod
    def array(self, frame_id: str) -> np.ndarray: ...
    @abstractmethod
    def frame_science(self, frame_id: str) -> tuple[np.ndarray, np.ndarray, np.ndarray]: ...


class SyntheticObservationProvider(ObservationProvider):
    def observations(self, request: FieldRequest) -> ObservationSet:
        request = canonical(request)
        key = field_key(request)
        scene(key)
        start = datetime(2025, 1, 15, 3, 24, tzinfo=timezone.utc)
        frames = [
            Frame(
                id=f'{key}.{i}',
                timestamp=(start + timedelta(days=90 * i)).isoformat(),
                image_url=f'/api/frames/{key}.{i}.png',
                detector=request.detector,
                source='synthetic',
                quality=Quality(registration='Common synthetic tangent-plane grid', noise_sigma=2.5, calibrated=False),
            )
            for i in range(FRAME_COUNT)
        ]
        return ObservationSet(
            source_type='synthetic',
            dataset_id='skytrace-synthetic-v1-' + hashlib.sha256(key.encode()).hexdigest()[:12],
            request=request,
            frames=frames,
            wavelength_range_um=RANGES[int(request.detector[1]) - 1],
        )

    def array(self, frame_id: str) -> np.ndarray:
        req, i = decode_frame(frame_id)
        return scene(field_key(req))[i]

    def frame_science(self, frame_id: str) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        arr = self.array(frame_id)
        var = np.full_like(arr, 2.5**2, dtype=np.float32)
        valid = np.ones_like(arr, dtype=bool)
        return arr, var, valid


class SpherexIRSAProvider(ObservationProvider):
    """Real astronomical data provider backed by NASA/IPAC IRSA SPHEREx DR1+QR3."""

    def __init__(self, client: IrsaSpherexClient | None = None, fixtures_mode: bool | None = None):
        self.client = client or IrsaSpherexClient()
        self.fixtures_mode = fixtures_mode if fixtures_mode is not None else (os.getenv("SPHEREX_FIXTURES_MODE") == "1")

    def _get_offline_fixtures(self, request: FieldRequest) -> list[dict]:
        """Load deterministic test fixtures for offline testing."""
        fixtures_dir = Path(__file__).resolve().parents[1] / "tests" / "fixtures"
        f1 = fixtures_dir / "epoch1_spherex_mef.fits"
        f2 = fixtures_dir / "epoch2_spherex_mef.fits"
        if not (f1.exists() and f2.exists()):
            return []

        return [
            {
                "id": f"spx.{request.detector}.2025W18_1B_0074_2.60794016",
                "obs_id": "2025W18_1B_0074_2",
                "timestamp": "2025-04-29T00:24:27.897Z",
                "mjd": 60794.016989,
                "access_url": "https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2025W18_1B/l2b-v27-2026-196/1/level2_2025W18_1B_0074_2D1_spx_l2b-v27-2026-196.fits",
                "cutout_url": "https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2025W18_1B/l2b-v27-2026-196/1/level2_2025W18_1B_0074_2D1_spx_l2b-v27-2026-196.fits?center=304.6935,42.4436d&size=0.05",
                "local_fixture": str(f1),
                "detector": request.detector,
                "collection": "spherex_dr1",
                "center_ra": request.ra,
                "center_dec": request.dec,
                "fov_arcmin": request.fov_arcmin,
            },
            {
                "id": f"spx.{request.detector}.2025W30_1B_0102_4.60884590",
                "obs_id": "2025W30_1B_0102_4",
                "timestamp": "2025-07-28T14:10:05.120Z",
                "mjd": 60884.590337,
                "access_url": "https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2025W30_1B/l2b-v27-2026-196/1/level2_2025W30_1B_0102_4D1_spx_l2b-v27-2026-196.fits",
                "cutout_url": "https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/2025W30_1B/l2b-v27-2026-196/1/level2_2025W30_1B_0102_4D1_spx_l2b-v27-2026-196.fits?center=304.6935,42.4436d&size=0.05",
                "local_fixture": str(f2),
                "detector": request.detector,
                "collection": "spherex_dr1",
                "center_ra": request.ra,
                "center_dec": request.dec,
                "fov_arcmin": request.fov_arcmin,
            },
        ]

    def observations(self, request: FieldRequest) -> ObservationSet:
        request = canonical(request)
        cache_k = f"spx:{request.ra:.6f}:{request.dec:.6f}:{request.fov_arcmin:.4f}:{request.detector}"
        cached_manifest = MANIFEST_CACHE.get(cache_k)
        if cached_manifest is not None:
            return cached_manifest

        records: list[dict] = []
        if self.fixtures_mode:
            records = self._get_offline_fixtures(request)
        else:
            try:
                records = self.client.search_observations(
                    ra=request.ra,
                    dec=request.dec,
                    fov_arcmin=request.fov_arcmin,
                    detector=request.detector,
                )
            except Exception as exc:
                logger.warning("Upstream IRSA observation discovery failed: %s", exc)
                records = []

        d_idx = int(request.detector[1]) - 1
        wavelength_range = RANGES[d_idx]

        if not records:
            empty_set = ObservationSet(
                source_type="spherex-irsa",
                dataset_id=f"spx-empty-{hashlib.sha256(cache_k.encode()).hexdigest()[:12]}",
                request=request,
                coordinate_system="ICRS",
                intensity_unit="MJy / sr",
                wavelength_range_um=wavelength_range,
                release="DR1+QR3",
                frames=[],
                notice="No SPHEREx archival observations found covering these coordinates and detector in DR1+QR3.",
            )
            MANIFEST_CACHE.set(cache_k, empty_set)
            return empty_set

        frames: list[Frame] = []
        for rec in records:
            frame_id = rec["id"]
            register_frame_record(frame_id, rec)
            frames.append(
                Frame(
                    id=frame_id,
                    timestamp=rec["timestamp"],
                    image_url=f"/api/frames/{frame_id}.png",
                    detector=request.detector,
                    source="spherex-irsa",
                    product_id=rec["obs_id"],
                    provenance_url=rec["access_url"],
                    quality=Quality(
                        registration="Astropy WCS celestial TAN projection",
                        noise_sigma=0.5,
                        masked_fraction=0.0,
                        calibrated=True,
                        flags=["calibrated_dr1_qr3"],
                        notes=["Level 2 spectral image cutout"],
                    ),
                )
            )

        manifest = ObservationSet(
            source_type="spherex-irsa",
            dataset_id=f"spx-dr1-{hashlib.sha256(cache_k.encode()).hexdigest()[:12]}",
            request=request,
            coordinate_system="ICRS",
            intensity_unit="MJy / sr",
            wavelength_range_um=wavelength_range,
            release="DR1+QR3",
            frames=frames,
            notice="Actual archived SPHEREx data (DR1+QR3); calibrated spectral image cutouts from NASA/IPAC IRSA.",
        )
        MANIFEST_CACHE.set(cache_k, manifest)
        return manifest

    def array(self, frame_id: str) -> np.ndarray:
        flux, _, _ = self.frame_science(frame_id)
        return flux

    def frame_science(self, frame_id: str) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        cached = SCIENCE_CACHE.get(frame_id)
        if cached is not None:
            return cached

        record = get_frame_record(frame_id)
        if record is None:
            raise ValueError(f"Unknown frame identifier: {frame_id}")

        fits_bytes: bytes
        if "local_fixture" in record and Path(record["local_fixture"]).exists():
            fits_bytes = Path(record["local_fixture"]).read_bytes()
        else:
            fits_bytes = self.client.fetch_cutout_bytes(record["cutout_url"])

        center_coord = SkyCoord(ra=record["center_ra"], dec=record["center_dec"], unit="deg", frame="icrs")
        cutout = parse_spherex_mef(fits_bytes, target_coord=center_coord)

        flux, var, valid_mask = reproject_to_grid(
            cutout=cutout,
            target_ra=record["center_ra"],
            target_dec=record["center_dec"],
            fov_arcmin=record["fov_arcmin"],
            size=SIZE,
        )

        SCIENCE_CACHE.set(frame_id, (flux, var, valid_mask))
        ARRAY_CACHE.set(frame_id, flux)
        return flux, var, valid_mask
