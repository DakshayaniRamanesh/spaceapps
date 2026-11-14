from pathlib import Path
import numpy as np
from astropy.coordinates import SkyCoord
from app.science.fits_loader import parse_spherex_mef

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "epoch1_spherex_mef.fits"


def test_parse_spherex_mef_structure():
    assert FIXTURE_PATH.exists()
    content = FIXTURE_PATH.read_bytes()
    coord = SkyCoord(304.6935, 42.4436, unit="deg")
    cutout = parse_spherex_mef(content, target_coord=coord)

    assert cutout.pipeline_version == "7.0.5"
    assert cutout.unit == "MJy / sr"
    assert cutout.detector == "D1"
    assert cutout.obs_id == "2025W18_1B_0074_2"
    assert cutout.image.shape == (32, 32)
    assert cutout.flags.shape == (32, 32)
    assert cutout.variance.shape == (32, 32)
    assert cutout.flags[2, 2] == 1
    assert cutout.mask[2, 2] == True  # Bad pixel is masked
    assert cutout.date_obs == "2025-04-29T00:24:27.897"
    assert np.isclose(cutout.mjd_obs, 60794.016989)
    assert cutout.central_wavelength_um is not None
    assert 0.7 <= cutout.central_wavelength_um <= 1.2
