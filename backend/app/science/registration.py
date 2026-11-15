"""Astrometric WCS registration to a common celestial tangent-plane grid."""
from __future__ import annotations

import numpy as np
from astropy.wcs import WCS
from reproject import reproject_interp

from .fits_loader import SpherexFitsCutout

GRID_SIZE = 384


def make_target_wcs(ra: float, dec: float, fov_arcmin: float, size: int = GRID_SIZE) -> WCS:
    """Create a canonical tangent-plane (TAN) celestial WCS centered at (ra, dec)."""
    pixel_scale_deg = (fov_arcmin / 60.0) / float(size)
    wcs = WCS(naxis=2)
    wcs.wcs.crpix = [size / 2.0 + 0.5, size / 2.0 + 0.5]
    wcs.wcs.cdelt = [-pixel_scale_deg, pixel_scale_deg]
    wcs.wcs.crval = [ra, dec]
    wcs.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    return wcs


def reproject_to_grid(
    cutout: SpherexFitsCutout,
    target_ra: float,
    target_dec: float,
    fov_arcmin: float,
    size: int = GRID_SIZE,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Reproject scientific cutout image, variance, and validity mask to the target tangent-plane grid.
    
    Returns:
        (reprojected_image, reprojected_variance, valid_footprint_mask)
        All arrays of shape (size, size).
    """
    target_wcs = make_target_wcs(target_ra, target_dec, fov_arcmin, size=size)
    shape_out = (size, size)

    # Clean input image (replace NaNs with median/0 for interpolation)
    img = cutout.image.copy()
    fill_value = float(np.nanmedian(img)) if np.any(np.isfinite(img)) else 0.0
    img[~np.isfinite(img)] = fill_value

    reprojected_flux, footprint = reproject_interp(
        (img, cutout.spatial_wcs),
        target_wcs,
        shape_out=shape_out,
        order="bilinear",
    )

    # Reproject variance using order='nearest' to preserve error characteristics
    var_clean = cutout.variance.copy()
    var_fill = float(np.nanmedian(var_clean)) if np.any(np.isfinite(var_clean)) else 1.0
    var_clean[~np.isfinite(var_clean)] = var_fill

    reprojected_var, _ = reproject_interp(
        (var_clean, cutout.spatial_wcs),
        target_wcs,
        shape_out=shape_out,
        order="nearest-neighbor",
    )

    # Reproject invalid mask (float representation: 1 = invalid, 0 = valid)
    mask_in = cutout.mask.astype(np.float32)
    reprojected_mask_val, _ = reproject_interp(
        (mask_in, cutout.spatial_wcs),
        target_wcs,
        shape_out=shape_out,
        order="bilinear",
    )

    # Valid sky footprint: covered by input footprint (> 0.5) and not masked (< 0.5) and finite
    in_footprint = footprint > 0.5
    valid_mask = in_footprint & (reprojected_mask_val < 0.5) & np.isfinite(reprojected_flux)

    # Fill invalid/outside-footprint pixels with 0 or local background
    final_flux = np.where(in_footprint & np.isfinite(reprojected_flux), reprojected_flux, 0.0).astype(np.float32)
    final_var = np.where(in_footprint & np.isfinite(reprojected_var), reprojected_var, 0.0).astype(np.float32)

    return final_flux, final_var, valid_mask
