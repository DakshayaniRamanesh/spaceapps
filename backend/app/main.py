import json
import math
import os
from pathlib import Path
from functools import lru_cache
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from astropy.time import Time
from .models import FieldRequest, Detector, ObservationSet
from .providers import (
    SyntheticObservationProvider,
    SpherexIRSAProvider,
    decode_frame,
    render_frame,
    render_difference,
    difference_arrays,
)
from .science.difference import (
    render_science_frame,
    render_difference_frame,
    compute_difference,
    compute_significance,
    render_significance_frame,
)
from .services.catalogs import query_gaia_dr3

app = FastAPI(
    title='SkyTrace Observation API',
    version='2.0.0',
    description='NASA Space Apps explorer providing both synthetic simulations and real SPHEREx DR1+QR3 observations.',
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(','),
    allow_methods=['GET'],
    allow_headers=['*'],
)

source = os.getenv('OBSERVATION_SOURCE', 'synthetic')
if source not in ('synthetic', 'irsa'):
    raise RuntimeError('OBSERVATION_SOURCE must be synthetic or irsa')

provider = SyntheticObservationProvider() if source == 'synthetic' else SpherexIRSAProvider()


@app.get('/health')
def health():
    if source == 'irsa':
        return {'status': 'ok', 'source': 'spherex-irsa', 'real_data_enabled': True}
    return {'status': 'ok', 'source': 'synthetic', 'real_data_enabled': False}


@app.get('/api/presets')
def presets():
    return json.loads((Path(__file__).parent / 'presets.json').read_text())


def _parse_mjd(value: str | None, name: str) -> float | None:
    if value is None:
        return None
    try:
        return float(Time(value, format="iso", scale="utc").mjd)
    except Exception:
        raise HTTPException(422, f"{name} must be an ISO date, e.g. 2025-06-01")


@app.get('/api/observations', response_model=ObservationSet)
def observations(
    ra: float = Query(ge=0, lt=360, allow_inf_nan=False),
    dec: float = Query(ge=-90, le=90, allow_inf_nan=False),
    fov_arcmin: float = Query(12, ge=2, le=60, allow_inf_nan=False),
    detector: Detector = 'D1',
    limit: int = Query(12, ge=2, le=50, description="Max epochs to shortlist (2–50)"),
    start_date: str | None = Query(None, pattern=r'^\d{4}-\d{2}-\d{2}$',
                                   description="Inclusive observation-window start (ISO date, UTC)"),
    end_date: str | None = Query(None, pattern=r'^\d{4}-\d{2}-\d{2}$',
                                 description="Inclusive observation-window end (ISO date, UTC)"),
    spread: bool = Query(False, description="Sample ~one epoch per 30-day bin across the survey"),
    min_wavelength_um: float | None = Query(
        None, gt=0, allow_inf_nan=False,
        description="Inclusive minimum field-center WCS-WAVE wavelength in microns; applied after epoch shortlisting",
    ),
    max_wavelength_um: float | None = Query(
        None, gt=0, allow_inf_nan=False,
        description="Inclusive maximum field-center WCS-WAVE wavelength in microns; applied after epoch shortlisting",
    ),
):
    if (min_wavelength_um is not None and max_wavelength_um is not None
            and min_wavelength_um > max_wavelength_um):
        raise HTTPException(422, "min_wavelength_um must not exceed max_wavelength_um")
    if (isinstance(provider, SyntheticObservationProvider)
            and (min_wavelength_um is not None or max_wavelength_um is not None)):
        raise HTTPException(422, "Wavelength filtering requires real SPHEREx WCS-WAVE data; synthetic frames have no measured wavelength")
    start_mjd = _parse_mjd(start_date, "start_date")
    end_mjd = _parse_mjd(end_date, "end_date")
    if start_date is not None and end_date is not None and start_date >= end_date:
        raise HTTPException(422, "start_date must be before end_date")
    if end_mjd is not None:
        # Include every observation on end_date, through the final representable
        # MJD before midnight on the following UTC date.
        end_mjd = math.nextafter(end_mjd + 1.0, -math.inf)
    try:
        return provider.observations(
            FieldRequest(
                ra=ra, dec=dec, fov_arcmin=fov_arcmin, detector=detector,
                min_wavelength_um=min_wavelength_um, max_wavelength_um=max_wavelength_um,
            ),
            limit=limit, start_mjd=start_mjd, end_mjd=end_mjd, spread=spread,
        )
    except NotImplementedError as exc:
        raise HTTPException(503, str(exc))
    except Exception as exc:
        raise HTTPException(502, f"Observation query failed: {exc}")


@lru_cache(maxsize=128)
def frame_bytes(frame_id: str, overlay: str | None = None) -> tuple[bytes, str]:
    is_real = frame_id.startswith('spx.')
    source_label = 'spherex-irsa' if is_real else 'synthetic'
    if overlay == 'mask':
        arr, _var, valid_mask = provider.frame_science(frame_id)
        content = render_science_frame(
            arr, mask=valid_mask, is_calibrated=is_real, show_mask_overlay=True
        )
        return content, source_label
    arr = provider.array(frame_id)
    if is_real:
        content = render_science_frame(arr, is_calibrated=True)
    else:
        content = render_frame(arr)
    return content, source_label


@app.get('/api/frames/{frame_id}.png', responses={200: {'content': {'image/png': {}}}})
def frame(
    frame_id: str,
    overlay: str | None = Query(default=None, pattern='^mask$'),
):
    try:
        content, source_label = frame_bytes(frame_id, overlay)
        return Response(
            content,
            media_type='image/png',
            headers={
                'Cache-Control': 'public, max-age=86400',
                'X-Data-Source': source_label,
                'X-Quality-Overlay': overlay or 'none',
            },
        )
    except ValueError as exc:
        raise HTTPException(404, str(exc))
    except NotImplementedError as exc:
        raise HTTPException(503, str(exc))
    except Exception as exc:
        raise HTTPException(502, f"Failed rendering frame {frame_id}: {exc}")


@lru_cache(maxsize=64)
def difference_bytes(
    frame_a: str,
    frame_b: str,
    view: str = 'diff',
    overlay: str | None = None,
) -> tuple[bytes, str]:
    is_real_a = frame_a.startswith('spx.')
    is_real_b = frame_b.startswith('spx.')
    if is_real_a != is_real_b:
        raise ValueError('Cannot compare real archival frames with synthetic frames.')

    show_mask = overlay == 'mask'

    if not is_real_a:
        req_a, _ = decode_frame(frame_a)
        req_b, _ = decode_frame(frame_b)
        if req_a != req_b:
            raise ValueError('Compare frames from the same registered field and detector.')
        arr_a, var_a, valid_a = provider.frame_science(frame_a)
        arr_b, var_b, valid_b = provider.frame_science(frame_b)
        if view == 'significance':
            sig, valid_both, _ = compute_significance(arr_a, arr_b, var_a, var_b, valid_a, valid_b)
            return render_significance_frame(sig, valid_mask=valid_both), 'synthetic'
        diff = difference_arrays(arr_a, arr_b)
        if show_mask:
            return render_difference_frame(diff, valid_mask=valid_a & valid_b, is_calibrated=False, show_mask_overlay=True), 'synthetic'
        return render_difference(diff), 'synthetic'
    else:
        arr_a, var_a, valid_a = provider.frame_science(frame_a)
        arr_b, var_b, valid_b = provider.frame_science(frame_b)
        if view == 'significance':
            sig, valid_both, _ = compute_significance(arr_a, arr_b, var_a, var_b, valid_a, valid_b)
            return render_significance_frame(sig, valid_mask=valid_both), 'spherex-irsa'
        diff, valid_both = compute_difference(arr_a, arr_b, valid_a, valid_b)
        return render_difference_frame(diff, valid_mask=valid_both, is_calibrated=True, show_mask_overlay=show_mask), 'spherex-irsa'


@app.get('/api/difference', responses={200: {'content': {'image/png': {}}}})
def difference(
    frame_a: str = Query(max_length=240),
    frame_b: str = Query(max_length=240),
    view: str = Query('diff', pattern='^(diff|significance)$'),
    overlay: str | None = Query(default=None, pattern='^mask$'),
):
    try:
        # Check validation
        is_real_a = frame_a.startswith('spx.')
        is_real_b = frame_b.startswith('spx.')
        if is_real_a != is_real_b:
            raise HTTPException(422, 'Cannot compare real archival frames with synthetic frames.')
        if not is_real_a:
            a, _ = decode_frame(frame_a)
            b, _ = decode_frame(frame_b)
            if a != b:
                raise HTTPException(422, 'Compare frames from the same registered field and detector.')

        content, source_label = difference_bytes(frame_a, frame_b, view=view, overlay=overlay)
        return Response(
            content,
            media_type='image/png',
            headers={
                'Cache-Control': 'public, max-age=86400',
                'X-Data-Source': source_label,
                'X-Difference-Sign': 'B-minus-A',
                'X-Difference-View': view,
                'X-Quality-Overlay': overlay or 'none',
            },
        )
    except ValueError as exc:
        raise HTTPException(404, str(exc))
    except HTTPException:
        raise
    except NotImplementedError as exc:
        raise HTTPException(503, str(exc))
    except Exception as exc:
        raise HTTPException(502, f"Failed calculating difference: {exc}")


@app.get('/api/catalog/gaia')
def get_gaia_catalog(
    ra: float = Query(..., ge=0, lt=360, description="ICRS Right Ascension in degrees"),
    dec: float = Query(..., ge=-90, le=90, description="ICRS Declination in degrees"),
    fov_arcmin: float = Query(12.0, ge=2, le=60, description="Field of view in arcminutes"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of sources to return"),
):
    try:
        return query_gaia_dr3(ra=ra, dec=dec, fov_arcmin=fov_arcmin, limit=limit)
    except Exception as exc:
        raise HTTPException(502, f"Failed querying Gaia DR3: {exc}")
