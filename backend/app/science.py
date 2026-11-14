"""FITS-to-display processing. Preview products never imply a validated detection.

Arrays stay in MJy/sr. Reprojection uses bilinear weights; variances use squared
weights, but inter-pixel covariance and foreground-model errors are not modeled.
"""
from dataclasses import dataclass
import hashlib
import io
import re

import numpy as np
from astropy import units as u
from astropy.coordinates import SkyCoord
from astropy.io import fits
from astropy.time import Time
from astropy.wcs import WCS
from scipy.ndimage import maximum_filter
from scipy.spatial import cKDTree

from .models import Check, FieldRequest, Pair, Quality
from .providers import png

VERSION = 'irsa-preview-v2.2'
# SOURCE and FULLSAMPLE describe status, not unusable measurements. All other
# documented flags, and any unknown set bits, are conservatively masked.
RETAIN_FLAGS = {'SOURCE', 'FULLSAMPLE'}


@dataclass
class Prepared:
    intensity: np.ndarray
    variance: np.ndarray
    wavelength: np.ndarray
    bandwidth: np.ndarray
    quality: Quality
    timestamp: str
    lambda_um: float | None
    bandwidth_um: float | None
    version: str
    sha256: str


def target_grid(req: FieldRequest) -> tuple[WCS, int]:
    # Native sampling, rather than manufacturing apparent spatial resolution.
    size = int(np.ceil(req.fov_arcmin * 60 / 6.15))
    w = WCS(naxis=2)
    w.wcs.crpix = [(size + 1) / 2, (size + 1) / 2]
    w.wcs.cdelt = [-req.fov_arcmin / 60 / size, req.fov_arcmin / 60 / size]
    w.wcs.crval = [req.ra, req.dec]
    w.wcs.ctype = ['RA---TAN', 'DEC--TAN']
    w.wcs.radesys = 'ICRS'
    return w, size


def flags_mask(flags, header):
    definitions = {int(k[4:]): str(header[k]).strip() for k in header
                   if re.fullmatch(r'MSKN\d{4}', k)}
    retained = sum(1 << bit for bit, name in definitions.items() if name in RETAIN_FLAGS)
    bits = np.asarray(flags, dtype=np.uint32)
    bad = (bits & np.uint32(0xFFFFFFFF ^ retained)) != 0
    counts = {name: int(np.count_nonzero(bits & (1 << bit))) for bit, name in definitions.items()}
    return bad, counts


def bilinear(data, variance, x, y):
    """Require all four contributing pixels valid. Never fill scientific holes."""
    h, w = data.shape
    safe = np.isfinite(x) & np.isfinite(y) & (x >= 0) & (y >= 0) & (x < w-1) & (y < h-1)
    ix = np.clip(np.nan_to_num(x, nan=0, posinf=0, neginf=0), 0, w-2).astype(int)
    iy = np.clip(np.nan_to_num(y, nan=0, posinf=0, neginf=0), 0, h-2).astype(int)
    dx, dy = x-ix, y-iy
    output, outvar = np.zeros(x.shape), np.zeros(x.shape)
    for ox, oy, weight in [(0, 0, (1-dx)*(1-dy)), (1, 0, dx*(1-dy)),
                           (0, 1, (1-dx)*dy), (1, 1, dx*dy)]:
        value, var = data[iy+oy, ix+ox], variance[iy+oy, ix+ox]
        safe &= np.isfinite(value) & np.isfinite(var) & (var > 0)
        output += np.nan_to_num(value) * weight
        outvar += np.nan_to_num(var) * weight**2
    return np.where(safe, output, np.nan).astype('float32'), np.where(safe, outvar, np.nan).astype('float32')


def prepare_fits(content: bytes, req: FieldRequest) -> Prepared:
    with fits.open(io.BytesIO(content), memmap=False) as hdus:
        for name in ('IMAGE', 'VARIANCE', 'FLAGS', 'ZODI', 'WCS-WAVE'):
            if name not in hdus:
                raise ValueError(f'Missing required FITS extension: {name}')
        image = np.asarray(hdus['IMAGE'].data, dtype='float32')
        if image.ndim != 2 or min(image.shape) < 2 or max(image.shape) > 2040:
            raise ValueError('Unsupported FITS image dimensions')
        unit = u.Unit(hdus['IMAGE'].header.get('BUNIT', ''))
        if not unit.is_equivalent(u.MJy / u.sr):
            raise ValueError('Expected surface brightness in MJy/sr')
        # Accept only the documented products' units; no silent calibration conversion.
        if unit != u.MJy / u.sr:
            raise ValueError('Unsupported surface-brightness scaling')
        var = np.asarray(hdus['VARIANCE'].data, dtype='float32')
        zodi = np.asarray(hdus['ZODI'].data, dtype='float32')
        flags = hdus['FLAGS'].data
        if any(a.shape != image.shape for a in (var, zodi, flags)):
            raise ValueError('FITS extensions have inconsistent shapes')
        bad, counts = flags_mask(flags, hdus['FLAGS'].header)
        bad |= ~np.isfinite(image) | ~np.isfinite(var) | (var <= 0) | ~np.isfinite(zodi)
        clean = np.where(bad, np.nan, image-zodi)
        variance = np.where(bad, np.nan, var)
        header = hdus['IMAGE'].header
        spatial = WCS(header).celestial
        grid, size = target_grid(req)
        yy, xx = np.mgrid[:size, :size]
        sky = grid.pixel_to_world(xx, yy)
        x, y = spatial.world_to_pixel(sky)
        aligned, aligned_var = bilinear(clean, variance, x, y)
        wave = np.full(aligned.shape, np.nan, dtype='float32')
        bandwidth = wave.copy()
        center_wave = center_band = None
        try:
            spectral = WCS(header, fobj=hdus, key='W')
            spectral.sip = None  # Spectral lookup coordinates must not receive celestial SIP.
            w, b = spectral.pixel_to_world(x, y)
            wave = np.asarray(w.to_value(u.um), dtype='float32')
            bandwidth = np.asarray(b.to_value(u.um), dtype='float32')
            cx, cy = spatial.world_to_pixel(SkyCoord(req.ra, req.dec, unit='deg'))
            cw, cb = spectral.pixel_to_world(cx, cy)
            if np.isfinite(cw.value) and np.isfinite(cb.value):
                center_wave, center_band = float(cw.to_value(u.um)), float(cb.to_value(u.um))
        except (ValueError, KeyError, TypeError, IndexError):
            # Wavelength unknown is a preview limitation, never a fabricated band.
            pass
        valid = np.isfinite(aligned)
        if not valid.any():
            raise ValueError('No valid pixels overlap the requested field')
        wave[~valid] = np.nan
        bandwidth[~valid] = np.nan
        # DATE-OBS in SPHEREx IMAGE headers is UTC. Preserve subsecond precision.
        if 'DATE-OBS' in header:
            timestamp = Time(header['DATE-OBS'], format='isot', scale='utc').isot + 'Z'
        elif 'MJD-OBS' in header:
            timestamp = Time(header['MJD-OBS'], format='mjd', scale='utc').isot + 'Z'
        else:
            raise ValueError('Observation timestamp missing from FITS')
        quality = Quality(
            registration='Celestial WCS reprojection; measured pair residual reported separately',
            noise_sigma=float(np.median(np.sqrt(aligned_var[valid]))),
            masked_fraction=float(1-valid.mean()), valid_fraction=float(valid.mean()),
            calibrated=True, flag_counts=counts,
            flag_policy='Conservative: retain SOURCE/FULLSAMPLE; mask other and unknown set bits',
            background_mjy_sr=float(np.nanmedian(zodi)),
            center_valid=bool(valid[size//2, size//2]),
            center_region_valid_fraction=float(valid[(xx-(size-1)/2)**2+(yy-(size-1)/2)**2 <= 4].mean()),
        )
        return Prepared(aligned, aligned_var, wave, bandwidth, quality, timestamp,
                        center_wave, center_band, str(hdus[0].header.get('VERSION', 'unknown')),
                        hashlib.sha256(content).hexdigest())


def display_stretch(arrays):
    values = np.concatenate([a[np.isfinite(a)] for a in arrays])
    lo, hi = np.percentile(values, [1, 99.7])
    return {'low': float(lo), 'high': float(max(hi, lo + 1e-4)), 'asinh_softening': 0.08}


def real_png(arr, stretch):
    valid = np.isfinite(arr)
    v = np.clip((np.nan_to_num(arr, nan=stretch['low'])-stretch['low']) /
                (stretch['high']-stretch['low']), 0, 1)
    soft = stretch['asinh_softening']
    v = np.arcsinh(v/soft)/np.arcsinh(1/soft)
    # FITS array origin is lower left; PNG origin is upper left. Flip display only.
    rgba = np.stack([v*.88, v*.95, v, valid.astype(float)], axis=-1)*255
    return png(np.flipud(rgba))


def reference_sources(image, variance):
    valid = np.isfinite(image) & np.isfinite(variance)
    background = np.nanmedian(image)
    noise = np.nanmedian(np.sqrt(variance[valid])) if valid.any() else np.inf
    a = np.where(valid, image, -np.inf)
    peaks = valid & (a == maximum_filter(a, size=7)) & (a > background + 10*noise)
    yy, xx = np.where(peaks)
    points = []
    for y, x in zip(yy, xx):
        if min(x, y, image.shape[1]-1-x, image.shape[0]-1-y) < 4:
            continue
        # Exclude the center target, which may genuinely move.
        if np.hypot(x-(image.shape[1]-1)/2, y-(image.shape[0]-1)/2) < 5:
            continue
        patch = image[y-2:y+3, x-2:x+3]
        if not np.isfinite(patch).all():
            continue
        weights = np.maximum(patch-np.median(patch), 0)
        if weights.sum() <= 0:
            continue
        py, px = np.mgrid[-2:3, -2:3]
        points.append((x+float((px*weights).sum()/weights.sum()),
                       y+float((py*weights).sum()/weights.sum())))
    return np.asarray(points).reshape(-1, 2)


def pair_report(a_id, b_id, a: Prepared, b: Prepared) -> Pair:
    valid = np.isfinite(a.intensity) & np.isfinite(b.intensity)
    overlap = float(valid.mean())
    denominator = np.minimum(a.bandwidth, b.bandwidth)
    spectral = valid & np.isfinite(a.wavelength) & np.isfinite(b.wavelength) & (denominator > 0)
    spectral &= np.abs(a.wavelength-b.wavelength) <= 0.25*denominator
    fraction = float(spectral.sum()/max(valid.sum(), 1))
    refs_a, refs_b = reference_sources(a.intensity, a.variance), reference_sources(b.intensity, b.variance)
    rms = None
    matches = 0
    if len(refs_a) and len(refs_b):
        distances, nearest = cKDTree(refs_b).query(refs_a, distance_upper_bound=2)
        reverse = cKDTree(refs_a).query(refs_b)[1]
        keep = np.array([np.isfinite(d) and reverse[j] == i
                         for i, (d, j) in enumerate(zip(distances, nearest))])
        matches = int(keep.sum())
        if matches >= 3:
            rms = float(np.sqrt(np.mean(distances[keep]**2)))
    checks = [
        Check(name='Sky overlap', status='pass' if overlap >= .8 else 'blocked',
              reason='Valid pixels shared on the same north-up ICRS grid', value=overlap),
        Check(name='Spectral screening', status='pass' if fraction >= .9 else 'blocked',
              reason='Fraction of overlapping pixels within 0.25 of the narrower bandwidth; screening heuristic only', value=fraction),
        Check(name='Registration', status=('pass' if rms <= .3 else 'blocked') if rms is not None else 'review',
              reason=f'{matches} mutually matched field sources; empirical limit 0.3 native pixel', value=rms),
        Check(name='Spectral calibration', status='review',
              reason='WCS-WAVE is visualization-grade; response/calibration equivalence has not been established'),
        Check(name='PSF and background', status='review',
              reason='Zodiacal model subtracted once; PSF matching and residual-background validation remain unverified'),
        Check(name='Uncertainty', status='review',
              reason='Squared interpolation weights used; spatial covariance and model systematics are not calibrated'),
        Check(name='Distinct observation times', status='pass' if a.timestamp != b.timestamp else 'blocked',
              reason='Timestamps come from FITS observation metadata, not download or release dates'),
        Check(name='Center-region coverage',
              status=('pass' if min(a.quality.center_region_valid_fraction, b.quality.center_region_valid_fraction) >= .8 else 'blocked')
                     if a.quality.center_region_valid_fraction is not None and b.quality.center_region_valid_fraction is not None else 'review',
              reason='Valid fraction within two native pixels of the requested center; this is not a source detection',
              value=min(a.quality.center_region_valid_fraction, b.quality.center_region_valid_fraction)
                    if a.quality.center_region_valid_fraction is not None and b.quality.center_region_valid_fraction is not None else None),
    ]
    blocked = any(c.status == 'blocked' for c in checks)
    return Pair(a=a_id, b=b_id, comparison_status='blocked' if blocked else 'preview',
                difference_allowed=False,
                reason=('Wavelength, overlap or registration screening failed. Compare as labeled previews only.' if blocked else
                        'Aligned preview; scientific subtraction is blocked pending spectral-response, PSF and background validation.'),
                checks=checks, spectral_overlap_fraction=fraction, overlap_fraction=overlap)
