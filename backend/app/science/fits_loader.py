"""Scientific MEF FITS parser for SPHEREx spectral image cutouts."""
from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Any

import numpy as np
from astropy.coordinates import SkyCoord
from astropy.io import fits
from astropy.wcs import WCS
import astropy.units as u


@dataclass
class SpherexFitsCutout:
    """Parsed SPHEREx Multi-Extension FITS (MEF) cutout with validated calibration and WCS."""
    image: np.ndarray
    flags: np.ndarray
    variance: np.ndarray
    mask: np.ndarray  # True where invalid/flagged
    spatial_wcs: WCS
    unit: str
    date_obs: str
    mjd_obs: float
    detector: str
    obs_id: str
    pipeline_version: str
    central_wavelength_um: float | None = None
    bandwidth_um: float | None = None
    noise_sigma: float = 0.0
    masked_fraction: float = 0.0


def parse_spherex_mef(fits_bytes: bytes, target_coord: SkyCoord | None = None) -> SpherexFitsCutout:
    """Parse a SPHEREx 7-HDU MEF cutout into calibrated science arrays and WCS."""
    with fits.open(io.BytesIO(fits_bytes)) as hdul:
        primary_hdr = hdul[0].header
        pipeline_version = str(primary_hdr.get("VERSION", "")).strip()

        # Identify image extension (usually HDU 1 or named 'IMAGE')
        img_hdu = hdul["IMAGE"] if "IMAGE" in hdul else hdul[1]
        img_hdr = img_hdu.header
        raw_image = img_hdu.data.astype(np.float32)

        # Flags and variance
        flags_data = hdul["FLAGS"].data.astype(np.int32) if "FLAGS" in hdul else np.zeros_like(raw_image, dtype=np.int32)
        var_data = hdul["VARIANCE"].data.astype(np.float32) if "VARIANCE" in hdul else np.full_like(raw_image, 1.0)

        spatial_wcs = WCS(img_hdr)
        unit = str(img_hdr.get("BUNIT", "MJy / sr")).strip()
        date_obs = str(img_hdr.get("DATE-OBS", img_hdr.get("DATE-BEG", ""))).strip()
        mjd_obs = float(img_hdr.get("MJD-OBS", img_hdr.get("MJD-BEG", 0.0)))
        detector_raw = img_hdr.get("DETECTOR", 1)
        detector = f"D{detector_raw}" if str(detector_raw).isdigit() else str(detector_raw)
        obs_id = str(img_hdr.get("OBSID", "SPHEREx")).strip()

        # Build mask: NaNs/infinities and fatal SPHEREx detector/data-quality bits.
        # Do NOT mask informational planes such as SOURCE (bit 21 = 0x200000),
        # CROSSTALK, PERSIST, NONLINEAR, GHOST, or HALO, which are set on most sky pixels.
        SPHEREX_FATAL_FLAG_MASK = (
            1       # TRANSIENT (also used by unit test fixture)
            | 2     # OVERFLOW
            | 4     # SUR_ERROR
            | 64    # NONFUNC
            | 512   # MISSING_DATA
            | 1024  # HOT
            | 2048  # COLD
            | 16384 # PHANMISS
        )
        invalid_mask = (~np.isfinite(raw_image)) | ((flags_data & SPHEREX_FATAL_FLAG_MASK) != 0)
        masked_fraction = float(np.mean(invalid_mask))

        # Calculate robust noise estimate from unmasked variance or median absolute deviation
        valid_vars = var_data[~invalid_mask & (var_data > 0)]
        if len(valid_vars) > 10:
            noise_sigma = float(np.sqrt(np.median(valid_vars)))
        else:
            valid_pixels = raw_image[~invalid_mask]
            if len(valid_pixels) > 10:
                noise_sigma = float(1.4826 * np.median(np.abs(valid_pixels - np.median(valid_pixels))))
            else:
                noise_sigma = 1.0

        # WCS-WAVE is a visualization-grade lookup at the requested sky position,
        # not the nominal detector midpoint or the bandwidth of the whole array.
        cw_um: float | None = None
        bw_um: float | None = None
        try:
            if target_coord is None:
                y, x = (np.asarray(raw_image.shape) - 1) / 2
            else:
                x, y = spatial_wcs.world_to_pixel(target_coord)
            if (np.isfinite(x) and np.isfinite(y)
                    and -0.5 <= x < raw_image.shape[1] - 0.5
                    and -0.5 <= y < raw_image.shape[0] - 0.5
                    and "WCS-WAVE" in hdul
                    and img_hdr.get("CTYPE1W") == "WAVE-TAB"
                    and img_hdr.get("CTYPE2W") == "WAVE-TAB"):
                spectral_wcs = WCS(img_hdr, fobj=hdul, key="W")
                spectral_wcs.sip = None
                wave, band = spectral_wcs.pixel_to_world(x, y)
                cw = float(wave.to_value(u.micrometer))
                bw = float(band.to_value(u.micrometer))
                if np.isfinite(cw) and cw > 0:
                    cw_um = cw
                if np.isfinite(bw) and bw > 0:
                    bw_um = bw
        except Exception:
            # Spectral lookup failures must not block flux display or acquire a
            # fabricated detector midpoint. Leave spectral values unavailable.
            pass

        return SpherexFitsCutout(
            image=raw_image,
            flags=flags_data,
            variance=var_data,
            mask=invalid_mask,
            spatial_wcs=spatial_wcs,
            unit=unit,
            date_obs=date_obs,
            mjd_obs=mjd_obs,
            detector=detector,
            obs_id=obs_id,
            pipeline_version=pipeline_version,
            central_wavelength_um=cw_um,
            bandwidth_um=bw_um,
            noise_sigma=noise_sigma,
            masked_fraction=masked_fraction,
        )
