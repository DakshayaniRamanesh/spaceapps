"""Generate offline test FITS fixtures mirroring genuine SPHEREx DR1 7-HDU MEFs."""
from pathlib import Path
import numpy as np
from astropy.io import fits
from astropy.wcs import WCS

FIXTURES_DIR = Path(__file__).parent


def create_spherex_mef_fixture(
    filename: str,
    ra: float = 304.6935,
    dec: float = 42.4436,
    detector: int = 1,
    obs_id: str = "2025W18_1B_0074_2",
    date_obs: str = "2025-04-29T00:24:27.897",
    mjd_obs: float = 60794.016989,
    shape: tuple[int, int] = (32, 32),
    variable_flux_delta: float = 0.0,
    motion_dx: float = 0.0,
    motion_dy: float = 0.0,
) -> Path:
    """Create a calibrated 7-HDU SPHEREx MEF fixture for deterministic offline testing."""
    ny, nx = shape
    yy, xx = np.mgrid[:ny, :nx]

    # Background level ~ 3.5 MJy/sr
    base_flux = (3.5 + 0.1 * np.sin(xx / 5.0) + 0.08 * np.cos(yy / 6.0)).astype(np.float32)

    # Stationary reference star at (10, 10)
    base_flux += (50.0 * np.exp(-((xx - 10.0)**2 + (yy - 10.0)**2) / (2 * 1.2**2))).astype(np.float32)

    # Moving source at (16 + dx, 16 + dy)
    mx = 16.0 + motion_dx
    my = 16.0 + motion_dy
    base_flux += (80.0 * np.exp(-((xx - mx)**2 + (yy - my)**2) / (2 * 1.2**2))).astype(np.float32)

    # Variable star at (24, 24) with flux modulation
    v_flux = 60.0 + variable_flux_delta
    base_flux += (v_flux * np.exp(-((xx - 24.0)**2 + (yy - 24.0)**2) / (2 * 1.2**2))).astype(np.float32)

    # Primary HDU
    primary_hdr = fits.Header()
    primary_hdr["SIMPLE"] = True
    primary_hdr["BITPIX"] = 8
    primary_hdr["NAXIS"] = 0
    primary_hdr["EXTEND"] = True
    primary_hdr["VERSION"] = "7.0.5"
    primary_hdu = fits.PrimaryHDU(header=primary_hdr)

    # HDU 1: IMAGE
    wcs = WCS(naxis=2)
    wcs.wcs.crpix = [nx / 2.0 + 0.5, ny / 2.0 + 0.5]
    wcs.wcs.cdelt = [-0.0017, 0.0017]
    wcs.wcs.crval = [ra, dec]
    wcs.wcs.ctype = ["RA---TAN-SIP", "DEC--TAN-SIP"]
    img_hdr = wcs.to_header()
    img_hdr["EXTNAME"] = "IMAGE"
    img_hdr["BUNIT"] = "MJy / sr"
    img_hdr["DETECTOR"] = detector
    img_hdr["OBSID"] = obs_id
    img_hdr["DATE-OBS"] = date_obs
    img_hdr["MJD-OBS"] = mjd_obs
    img_hdu = fits.ImageHDU(data=base_flux, header=img_hdr, name="IMAGE")

    # HDU 2: FLAGS
    flags = np.zeros(shape, dtype=np.int32)
    flags[2, 2] = 1  # 1 bad pixel for test coverage
    flags_hdr = fits.Header()
    flags_hdr["EXTNAME"] = "FLAGS"
    flags_hdu = fits.ImageHDU(data=flags, header=flags_hdr, name="FLAGS")

    # HDU 3: VARIANCE
    variance = np.full(shape, 0.25, dtype=np.float32)
    var_hdr = fits.Header()
    var_hdr["EXTNAME"] = "VARIANCE"
    var_hdr["BUNIT"] = "(MJy / sr)2"
    var_hdu = fits.ImageHDU(data=variance, header=var_hdr, name="VARIANCE")

    # HDU 4: ZODI
    zodi = np.full(shape, 2.8, dtype=np.float32)
    zodi_hdr = fits.Header()
    zodi_hdr["EXTNAME"] = "ZODI"
    zodi_hdu = fits.ImageHDU(data=zodi, header=zodi_hdr, name="ZODI")

    # HDU 5: EPSF
    epsf_col1 = fits.Column(name="CWAVE", format="E", array=np.array([0.75], dtype=np.float32))
    epsf_col2 = fits.Column(name="EPSF", format="1089D", dim="(33, 33)", array=np.zeros((1, 33, 33), dtype=np.float64))
    epsf_hdu = fits.BinTableHDU.from_columns([epsf_col1, epsf_col2], name="EPSF")

    # HDU 6: WCS-WAVE
    wave_col = fits.Column(name="VALUES", format="162E", dim="(9, 9, 2)", array=np.full((1, 9, 9, 2), 0.753, dtype=np.float32))
    wave_hdu = fits.BinTableHDU.from_columns([wave_col], name="WCS-WAVE")

    hdul = fits.HDUList([primary_hdu, img_hdu, flags_hdu, var_hdu, zodi_hdu, epsf_hdu, wave_hdu])
    out_path = FIXTURES_DIR / filename
    hdul.writeto(out_path, overwrite=True)
    return out_path


if __name__ == "__main__":
    p1 = create_spherex_mef_fixture("epoch1_spherex_mef.fits", date_obs="2025-04-29T00:24:27.897", mjd_obs=60794.016989, motion_dx=0.0, variable_flux_delta=0.0)
    p2 = create_spherex_mef_fixture("epoch2_spherex_mef.fits", date_obs="2025-07-28T14:10:05.120", mjd_obs=60884.590337, motion_dx=3.0, variable_flux_delta=40.0)
    print("Generated fixtures:", p1, p2)
