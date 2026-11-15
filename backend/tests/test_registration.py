from pathlib import Path
import numpy as np
from astropy.coordinates import SkyCoord
from app.science.fits_loader import parse_spherex_mef
from app.science.registration import reproject_to_grid, make_target_wcs

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "epoch1_spherex_mef.fits"


def test_target_wcs_geometry():
    wcs = make_target_wcs(304.6935, 42.4436, fov_arcmin=12.0, size=384)
    assert wcs.wcs.crpix[0] == 192.5
    assert wcs.wcs.crpix[1] == 192.5
    assert np.isclose(wcs.wcs.crval[0], 304.6935)
    assert np.isclose(wcs.wcs.crval[1], 42.4436)
    # Check pixel scale is 12 arcmin / 384 pixels = 0.03125 arcmin = 0.00052083 deg
    expected_scale = (12.0 / 60.0) / 384.0
    assert np.isclose(abs(wcs.wcs.cdelt[0]), expected_scale)


def test_reprojection_to_common_grid():
    content = FIXTURE_PATH.read_bytes()
    cutout = parse_spherex_mef(content, target_coord=SkyCoord(304.6935, 42.4436, unit="deg"))
    flux, var, valid_mask = reproject_to_grid(cutout, target_ra=304.6935, target_dec=42.4436, fov_arcmin=12.0, size=384)

    assert flux.shape == (384, 384)
    assert var.shape == (384, 384)
    assert valid_mask.shape == (384, 384)
    assert flux.dtype == np.float32
    assert np.any(valid_mask)
    # Within valid mask, flux should be positive (background ~ 3.5 MJy/sr)
    valid_flux = flux[valid_mask]
    assert np.all(valid_flux >= 0)
    assert valid_flux.max() > 40.0  # Point sources preserved
